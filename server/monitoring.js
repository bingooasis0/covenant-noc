const ping = require('ping');
const os = require('os');
const prisma = require('./prisma');
const snmp = require('./snmp');
const merakiApi = require('./meraki-api');
const limits = require('./limits');
const cache = require('./cache');

// Detect platform for ping command flags
// Development: Windows, Production: Ubuntu/Linux
const platform = os.platform();
const isWindows = platform === 'win32';
const isLinux = platform === 'linux';
const isMac = platform === 'darwin';

// Log platform detection for debugging
console.log(`[Monitor] Platform detected: ${platform} (Windows: ${isWindows}, Linux: ${isLinux}, Mac: ${isMac})`);

// Active monitoring intervals by site ID
const monitoringIntervals = new Map();
let io = null; // Socket.io instance

// Set IO instance
function setIo(ioInstance) {
  io = ioInstance;
}

// Track consecutive failures per site for hysteresis
const siteStatusState = new Map(); // { siteId: { consecutiveFailures: 0 } }

// Normalize values coming back from the ping library
function normalizeMetric(value) {
  if (value === null || value === undefined) return null;
  if (value === 'unknown' || value === 'NaN' || value === '') return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

// Ping a host and return metrics (numbers instead of strings)
async function pingHost(host, retries = 3) {
  // Use platform-specific ping flags
  // Windows: -n for count, -w for timeout (milliseconds)
  // Linux/Ubuntu: -c for count, -W for timeout (seconds) 
  // Mac: -c for count, -W for timeout (seconds)
  const pingConfig = isWindows 
    ? {
        timeout: 60, // Increase wrapper timeout to 60s to allow for packet timeouts (5 * 10s max)
        extra: ['-n', '5', '-w', '2000'] // Windows: send 5 packets, 2 second timeout per packet (reduced from 10s to avoid super long hangs)
      }
    : {
        timeout: 60, // 60s wrapper timeout
        extra: ['-c', '5', '-W', '2'] // Linux/Ubuntu/Mac: send 5 packets, 2 second timeout
      };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await ping.promise.probe(host, pingConfig);

      // Check if we got valid response data (even if alive is false, we might have partial data)
      const hasValidData = res.time !== undefined && res.time !== null && res.time !== 'unknown';
      
      // Normalize packet loss - ping library may return it as string or number
      let packetLoss = normalizeMetric(res.packetLoss);
      
      // If packetLoss is null/undefined, derive from alive status
      if (packetLoss === null || packetLoss === undefined) {
        packetLoss = res.alive ? 0 : 100;
      }
      
      // On Windows, the ping library may not always parse packetLoss correctly
      // If we got a successful ping but packetLoss is still 100, assume 0% loss
      if (res.alive && packetLoss >= 100) {
        packetLoss = 0;
      }
      
      // If we have valid latency data OR host is alive, consider it successful
      if (res.alive || hasValidData) {
        return {
          alive: res.alive || hasValidData,
          time: normalizeMetric(res.time),
          packetLoss: packetLoss,
          min: normalizeMetric(res.min),
          max: normalizeMetric(res.max),
          avg: normalizeMetric(res.avg),
          stddev: normalizeMetric(res.stddev)
        };
      }
      
      // If failed and we have retries left, wait and retry with exponential backoff
      if (attempt < retries) {
        const delay = Math.min(2000 * Math.pow(1.5, attempt), 5000); // Exponential backoff, max 5s
        console.log(`[Monitor] Ping failed for ${host}, retrying (attempt ${attempt + 1}/${retries + 1}) in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

    } catch (err) {
      // Only log error if it's not a timeout (timeouts are expected for down hosts)
      const isTimeout = err.message && (
        err.message.includes('timeout') || 
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('Request timeout')
      );
      
      if (!isTimeout) {
        console.error(`[Monitor] Ping error for ${host} (attempt ${attempt + 1}/${retries + 1}):`, err.message);
      }
      
      if (attempt < retries) {
        const delay = Math.min(2000 * Math.pow(1.5, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // All retries failed - return failure result
  // But don't immediately mark as 100% loss - this might be a transient network issue
  console.log(`[Monitor] All ping attempts failed for ${host} after ${retries + 1} tries`);
  return {
    alive: false,
    time: null,
    packetLoss: 100,
    min: null,
    max: null,
    avg: null,
    stddev: null
  };
}

// Determine status based on metrics
function calculateStatus(metrics) {
  if (!metrics.alive || metrics.packetLoss >= 100) {
    return 'critical'; // Host is down or 100% packet loss
  }

  if (metrics.packetLoss >= 75) {
    return 'critical'; // 75%+ packet loss is critical
  }

  if (metrics.packetLoss >= 25 || (metrics.avg && metrics.avg > 150)) {
    return 'degraded'; // 25%+ packet loss or >150ms latency
  }

  return 'operational'; // All good
}

// Monitor a single site
async function monitorSite(siteId, primaryIp, failoverIp = null, snmpCommunity = null) {
  let metrics = await pingHost(primaryIp);
  let activeIp = primaryIp;
  let usingFailover = false;

  // Try failover if primary fails
  if (!metrics.alive && failoverIp) {
    console.log(`Primary ${primaryIp} down, trying failover ${failoverIp}`);
    metrics = await pingHost(failoverIp);
    if (metrics.alive) {
      activeIp = failoverIp;
      usingFailover = true;
    }
  }

  const status = calculateStatus(metrics);

  // --- HYSTERESIS LOGIC START ---
  // Prevent flapping by requiring consecutive failures before marking as critical
  // Also track recent successes to avoid false positives
  if (!siteStatusState.has(siteId)) {
    siteStatusState.set(siteId, { 
      consecutiveFailures: 0,
      recentSuccesses: 0,
      lastSuccessTime: null
    });
  }
  
  const state = siteStatusState.get(siteId);
  let reportedStatus = status;
  // Clone metrics to avoid mutating the original object if we need it later
  let reportedMetrics = { ...metrics };

  if (status === 'critical') {
    state.consecutiveFailures++;
    
    // If we had recent successes (within last 5 minutes), be more lenient
    const recentSuccessWindow = 5 * 60 * 1000; // 5 minutes
    const hasRecentSuccess = state.lastSuccessTime && 
      (Date.now() - state.lastSuccessTime) < recentSuccessWindow;
    
    // Require more consecutive failures if we had recent successes (indicates flapping)
    const requiredFailures = hasRecentSuccess ? 5 : 3;
    
    if (state.consecutiveFailures < requiredFailures) {
      // Suppress the failure!
      console.log(`[Monitor] Site ${siteId} check failed (${state.consecutiveFailures}/${requiredFailures}), suppressing critical status. ${hasRecentSuccess ? 'Recent success detected - using stricter threshold.' : ''}`);
      reportedStatus = 'degraded'; // Keep status as degraded/operational
      
      // Suppress the packet loss in the reported metrics
      // so the dashboard graph doesn't show a "down" spike during these transient failures.
      // We'll report the actual packet loss but mark as alive to indicate "something is up but degraded"
      if (metrics.packetLoss >= 100) {
        reportedMetrics.packetLoss = Math.min(metrics.packetLoss, 50); // Cap at 50% for transient failures
      }
      reportedMetrics.alive = true;
    } else {
      // We've exceeded the threshold - this is a real failure
      console.log(`[Monitor] Site ${siteId} confirmed critical after ${state.consecutiveFailures} consecutive failures.`);
      state.recentSuccesses = 0; // Reset success counter
    }
  } else {
    // If we get a good ping, reset failure counter and track success
    if (state.consecutiveFailures > 0) {
      console.log(`[Monitor] Site ${siteId} recovered after ${state.consecutiveFailures} failures.`);
    }
    state.consecutiveFailures = 0;
    state.recentSuccesses = (state.recentSuccesses || 0) + 1;
    state.lastSuccessTime = Date.now();
    
    // Reset success counter if it gets too high (prevent overflow)
    if (state.recentSuccesses > 100) {
      state.recentSuccesses = 10;
    }
  }
  // --- HYSTERESIS LOGIC END ---

  // Store monitoring data (check if site still exists first)
  // Local database - no timeouts, maximum performance
  try {
    // Check cache first, then database
    let siteExists = cache.get(cache.CACHE_KEYS.SITE + siteId);
    if (!siteExists) {
      siteExists = await prisma.site.findUnique({ where: { id: siteId } });
      if (siteExists) {
        cache.set(cache.CACHE_KEYS.SITE + siteId, siteExists, cache.TTL.SITE);
      }
    }

    if (!siteExists) {
      console.log(`[Monitor] Site ${siteId} no longer exists, stopping monitoring`);
      stopMonitoring(siteId);
      return null;
    }

    // Local database - no storage limits
    // Store latency as avg (average of 5 pings) - this is the most accurate representation
    // If avg is null but we have a single ping time, use that as fallback
    const latencyToStore = reportedMetrics.avg !== null && reportedMetrics.avg !== undefined
      ? reportedMetrics.avg
      : (reportedMetrics.time !== null && reportedMetrics.time !== undefined ? reportedMetrics.time : null);
    
    await prisma.monitoringData.create({
      data: {
        siteId,
        latency: latencyToStore, // Average latency from 5 pings (or single ping fallback)
        packetLoss: reportedMetrics.packetLoss !== null && reportedMetrics.packetLoss !== undefined 
          ? reportedMetrics.packetLoss 
          : (reportedMetrics.alive ? 0 : 100),
        jitter: reportedMetrics.stddev // Standard deviation (jitter)
      }
    });
    
    // Invalidate monitoring cache after successful write
    cache.invalidateMonitoring(siteId);
  } catch (err) {
    // Log but don't fail the monitoring cycle - database issues shouldn't stop pings
    const isTimeout = err.message && err.message.includes('timeout');
    const isConnectionError = err.code === 'P1001' || err.code === 'P1002' || err.code === 'P1008';
    
    if (isTimeout || isConnectionError) {
      console.warn(`[Monitor] Database operation timeout/error for site ${siteId} (non-critical):`, err.message);
    } else {
      console.error(`[Monitor] Error storing data for site ${siteId}:`, err.message);
    }
    
    // Continue monitoring even if DB write fails - don't let DB issues cause false offline reports
    // The ping succeeded, so we still return the metrics
  }

  // Collect SNMP metrics if enabled
  if (snmpCommunity) {
    try {
      const snmpMetrics = await snmp.collectMetrics(activeIp, snmpCommunity);

      // Local database - no storage limits
      // Sanitize strings to remove null bytes
      const sanitize = (obj) => {
        if (typeof obj === 'string') return obj.replace(/\u0000/g, '');
        if (typeof obj === 'object' && obj !== null) {
          for (const key in obj) {
            obj[key] = sanitize(obj[key]);
          }
        }
        return obj;
      };

      const sanitizedMetrics = sanitize(snmpMetrics);

      const snmpRecord =       await prisma.snmpData.create({
        data: {
          siteId,
          cpuUsage: sanitizedMetrics.cpu,
          memoryUsage: sanitizedMetrics.memory?.usedPercent || null,
          uptime: sanitizedMetrics.uptime,
          interfaceStats: sanitizedMetrics.interfaces || {}
        }
      });

      // Invalidate SNMP cache after successful write
      cache.invalidateSnmp(siteId);

      // Log based on what data we got
      if (snmpMetrics.cpu || snmpMetrics.memory?.usedPercent) {
        // Traditional SNMP devices (non-Meraki)
        console.log(`[SNMP] Site ${siteId}: CPU ${snmpMetrics.cpu}%, Memory ${snmpMetrics.memory?.usedPercent}%`);
      } else if (snmpMetrics.interfaces && snmpMetrics.interfaces.length > 0) {
        // Meraki devices (interface data only)
        const activeInterfaces = snmpMetrics.interfaces.filter(i => i.status === 'up').length;
        console.log(`[SNMP] Site ${siteId}: ${activeInterfaces}/${snmpMetrics.interfaces.length} interfaces up`);
      }
    } catch (err) {
      console.error(`[SNMP] Site ${siteId} error:`, err.message);
    }
  }

  // Update site status (local database - no timeout)
  try {
    await prisma.site.update({
      where: { id: siteId },
      data: { status: reportedStatus, lastSeen: new Date() }
    });
  } catch (err) {
    // Log but don't fail - status update is less critical than data storage
    console.warn(`[Monitor] Failed to update site status for ${siteId}:`, err.message);
  }

  console.log(`[Monitor] Site ${siteId} (${activeIp}): ${reportedStatus} (raw: ${status}) - ${reportedMetrics.avg}ms, ${reportedMetrics.packetLoss}% loss`);

  // Emit real-time update
  if (io) {
    io.emit('site-metrics', {
      siteId,
      metrics: {
        ...reportedMetrics,
        latency: reportedMetrics.avg !== null ? reportedMetrics.avg : (reportedMetrics.time !== null ? reportedMetrics.time : null),
        packetLoss: reportedMetrics.packetLoss,
        timestamp: new Date().toISOString(),
        status: reportedStatus
      }
    });
  }

  return { ...reportedMetrics, status: reportedStatus, usingFailover, activeIp };
}

// Start monitoring a site
function startMonitoring(siteId, primaryIp, failoverIp = null, snmpCommunity = null, intervalSeconds = 60) {
  // Stop existing monitoring if any
  stopMonitoring(siteId);

  console.log(`[Monitor] Starting monitoring for site ${siteId} - ${primaryIp}`);

  // Add random startup delay (0-30s) to stagger checks and prevent server load spikes
  const initialDelay = Math.floor(Math.random() * 30000);
  
  setTimeout(() => {
    // Initial ping
    monitorSite(siteId, primaryIp, failoverIp, snmpCommunity);

    // Set up interval
    const interval = setInterval(() => {
      monitorSite(siteId, primaryIp, failoverIp, snmpCommunity);
    }, intervalSeconds * 1000);

    monitoringIntervals.set(siteId, interval);
  }, initialDelay);
}

// Stop monitoring a site
function stopMonitoring(siteId) {
  const interval = monitoringIntervals.get(siteId);
  if (interval) {
    clearInterval(interval);
    monitoringIntervals.delete(siteId);
    console.log(`[Monitor] Stopped monitoring for site ${siteId}`);
  }
}

// Start monitoring all sites for a user
async function startMonitoringForUser(userId) {
  const sites = await prisma.site.findMany({
    where: { monitoringIcmp: true }
  });

  sites.forEach(site => {
    const snmpCommunity = site.monitoringSnmp ? site.snmpCommunity : null;
    const interval = site.monitoringInterval || 60;
    startMonitoring(site.id, site.ip, site.failoverIp, snmpCommunity, interval);
  });

  console.log(`[Monitor] Started monitoring ${sites.length} sites`);
}

// Get latest monitoring data for a site
async function getLatestMetrics(siteId) {
  return await prisma.monitoringData.findFirst({
    where: { siteId },
    orderBy: { timestamp: 'desc' }
  });
}

// Get monitoring history for graphs
async function getMetricsHistory(siteId, hours = 1) {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  return await prisma.monitoringData.findMany({
    where: {
      siteId,
      timestamp: { gte: since }
    },
    orderBy: { timestamp: 'asc' }
  });
}

// Get latest SNMP data for a site
async function getLatestSnmpMetrics(siteId) {
  return await prisma.snmpData.findFirst({
    where: { siteId },
    orderBy: { timestamp: 'desc' }
  });
}

// Calculate uptime percentage over a rolling window
async function calculateUptime(siteId, hours = 24) {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      monitoringData: {
        where: { timestamp: { gte: since } }
      }
    }
  });

  if (!site || !site.monitoringData.length) {
    return null;
  }

  const total = site.monitoringData.length;
  const upCount = site.monitoringData.filter(d => d.status !== 'critical').length;
  const uptime = (upCount / total) * 100;
  return Number(uptime.toFixed(1));
}

// Cleanup old monitoring data (delegated to limits module)
async function cleanupOldData() {
  await limits.runAutomaticCleanup();
}

// Get Meraki API metrics
async function getMerakiMetrics(deviceIp, apiKey) {
  try {
    const metrics = await merakiApi.getDeviceMetrics(apiKey, deviceIp);
    return metrics;
  } catch (err) {
    console.error(`[Meraki API] Error getting metrics for ${deviceIp}:`, err.message);
    return { error: err.message };
  }
}

// Run cleanup every hour (limits module handles retention policies)
setInterval(cleanupOldData, 60 * 60 * 1000);

module.exports = {
  pingHost,
  monitorSite,
  startMonitoring,
  stopMonitoring,
  startMonitoringForUser,
  getLatestMetrics,
  getLatestSnmpMetrics,
  getMetricsHistory,
  calculateUptime,
  getMerakiMetrics,
  cleanupOldData,
  setIo
};
