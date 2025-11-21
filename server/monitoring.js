const ping = require('ping');
const prisma = require('./prisma');
const snmp = require('./snmp');
const merakiApi = require('./meraki-api');
const limits = require('./limits');

// Active monitoring intervals by site ID
const monitoringIntervals = new Map();

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
async function pingHost(host, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await ping.promise.probe(host, {
        timeout: 15, // 15 second timeout per ping
        extra: ['-c', '5'], // Linux: send 5 packets for better stability
      });

      // Check if we got valid response data (even if alive is false, we might have partial data)
      const hasValidData = res.time !== undefined && res.time !== null && res.time !== 'unknown';
      const packetLoss = normalizeMetric(res.packetLoss) ?? (res.alive ? 0 : 100);
      
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
      
      // If failed and we have retries left, wait and retry
      if (attempt < retries) {
        console.log(`[Monitor] Ping failed for ${host}, retrying (attempt ${attempt + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between retries
        continue;
      }

    } catch (err) {
      // Only log error if it's not a timeout (timeouts are expected for down hosts)
      if (!err.message.includes('timeout') && !err.message.includes('ETIMEDOUT')) {
        console.error(`[Monitor] Ping error for ${host} (attempt ${attempt + 1}):`, err.message);
      }
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
    }
  }

  // All retries failed - return failure result
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
  if (!siteStatusState.has(siteId)) {
    siteStatusState.set(siteId, { consecutiveFailures: 0 });
  }
  
  const state = siteStatusState.get(siteId);
  let reportedStatus = status;

  if (status === 'critical') {
    state.consecutiveFailures++;
    // Require 3 consecutive failures (approx 3 minutes) before alerting/changing status
    if (state.consecutiveFailures < 3) {
      // If previously operational/degraded, keep it that way for now to avoid blip
      // If this is the first check ever, we might default to 'degraded' or allow 'critical' if unknown
      // But generally we want to suppress the FIRST "down" signal
      console.log(`[Monitor] Site ${siteId} check failed (${state.consecutiveFailures}/3), suppressing critical status.`);
      reportedStatus = 'degraded'; // Show degraded instead of critical during verification phase
    }
  } else {
    // If we get a good ping, reset immediately
    if (state.consecutiveFailures > 0) {
      console.log(`[Monitor] Site ${siteId} recovered after ${state.consecutiveFailures} failures.`);
    }
    state.consecutiveFailures = 0;
  }
  // --- HYSTERESIS LOGIC END ---

  // Store monitoring data (check if site still exists first)
  try {
    const siteExists = await prisma.site.findUnique({ where: { id: siteId } });

    if (!siteExists) {
      console.log(`[Monitor] Site ${siteId} no longer exists, stopping monitoring`);
      stopMonitoring(siteId);
      return null;
    }

    // Check storage limits before creating (estimate ~100 bytes per record)
    await limits.checkBeforeCreate('MonitoringData', 100);

    await prisma.monitoringData.create({
      data: {
        siteId,
        latency: metrics.avg,
        packetLoss: metrics.packetLoss,
        jitter: metrics.stddev
      }
    });
  } catch (err) {
    console.error(`[Monitor] Error storing data for site ${siteId}:`, err.message);
    stopMonitoring(siteId);
    return null;
  }

  // Collect SNMP metrics if enabled
  if (snmpCommunity) {
    try {
      const snmpMetrics = await snmp.collectMetrics(activeIp, snmpCommunity);

      // Check storage limits before creating (estimate ~200 bytes per record)
      await limits.checkBeforeCreate('SnmpData', 200);

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

      await prisma.snmpData.create({
        data: {
          siteId,
          cpuUsage: sanitizedMetrics.cpu,
          memoryUsage: sanitizedMetrics.memory?.usedPercent || null,
          uptime: sanitizedMetrics.uptime,
          interfaceStats: sanitizedMetrics.interfaces || {}
        }
      });

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

  // Update site status
  await prisma.site.update({
    where: { id: siteId },
    data: { status: reportedStatus, lastSeen: new Date() }
  });

  console.log(`[Monitor] Site ${siteId} (${activeIp}): ${reportedStatus} (raw: ${status}) - ${metrics.avg}ms, ${metrics.packetLoss}% loss`);

  return { ...metrics, status: reportedStatus, usingFailover, activeIp };
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
  cleanupOldData
};
