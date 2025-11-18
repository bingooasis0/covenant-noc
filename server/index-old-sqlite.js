const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./db');
const monitoring = require('./monitoring');
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Session configuration with SQLite store (production-ready)
app.use(session({
  store: new SqliteStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000 // Clean up expired sessions every 15 minutes
    }
  }),
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true only when using HTTPS with a reverse proxy
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000 // 1000 requests per minute (increased for monitoring)
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ============ AUTH ROUTES ============

// Register (only if no users exist - first time setup)
app.post('/api/auth/register', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if users exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count > 0) {
      return res.status(403).json({ error: 'Registration is disabled' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);

    req.session.userId = result.lastInsertRowid;
    res.json({ success: true, username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check session
app.get('/api/auth/session', (req, res) => {
  if (req.session.userId) {
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.session.userId);
    res.json({ authenticated: true, user });
  } else {
    res.json({ authenticated: false });
  }
});

// ============ GEOCODING ROUTE (OpenStreetMap Nominatim - FREE) ============

app.get('/api/geocode', requireAuth, apiLimiter, async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }

  try {
    // Using OpenStreetMap Nominatim - completely free, no API key required
    // Try full address first
    let response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'NOCTURNAL-NOC-Dashboard/1.0' // Required by Nominatim usage policy
        }
      }
    );
    let data = await response.json();

    // If no results, try parsing and simplifying the address
    if (!data || data.length === 0) {
      // Extract city, state, zip from the address
      const parts = address.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // Try last parts (city, state zip)
        const simplified = parts.slice(-2).join(', ');
        response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(simplified)}&format=json&limit=1`,
          {
            headers: {
              'User-Agent': 'NOCTURNAL-NOC-Dashboard/1.0'
            }
          }
        );
        data = await response.json();
      }
    }

    if (data && data.length > 0) {
      const result = data[0];
      res.json({
        location: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      });
    } else {
      res.status(404).json({ error: 'Location not found' });
    }
  } catch (err) {
    console.error('Geocoding error:', err);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// ============ MONITORING ROUTES ============

app.get('/api/monitoring/:siteId', requireAuth, apiLimiter, (req, res) => {
  const metrics = monitoring.getLatestMetrics(req.params.siteId);

  if (!metrics) {
    return res.json({});
  }

  const uptime = monitoring.calculateUptime(req.params.siteId, 24);

  // Format for frontend
  res.json({
    isReachable: metrics.status === 'operational' || metrics.status === 'degraded',
    latency: metrics.latency !== null && metrics.latency !== undefined ? Math.round(metrics.latency) : null,
    packetLoss: metrics.packet_loss !== null && metrics.packet_loss !== undefined ? Number(metrics.packet_loss) : null,
    jitter: metrics.jitter !== null && metrics.jitter !== undefined ? Number(metrics.jitter) : null,
    status: metrics.status || 'unknown',
    usingFailover: metrics.using_failover === 1,
    activeIp: metrics.active_ip || null,
    timestamp: metrics.timestamp,
    uptime
  });
});

app.get('/api/monitoring/:siteId/history', requireAuth, apiLimiter, (req, res) => {
  const hours = parseInt(req.query.hours) || 1;
  const history = monitoring.getMetricsHistory(req.params.siteId, hours);
  res.json(history);
});

app.get('/api/monitoring/:siteId/snmp', requireAuth, apiLimiter, (req, res) => {
  const snmpMetrics = monitoring.getLatestSnmpMetrics(req.params.siteId);

  if (!snmpMetrics) {
    return res.json({});
  }

  const interfaces = snmpMetrics.interfaces ? JSON.parse(snmpMetrics.interfaces) : [];
  const systemInfo = snmpMetrics.system_info ? JSON.parse(snmpMetrics.system_info) : {};

  // Calculate interface statistics
  const activeInterfaces = interfaces.filter(i => i.status === 'up').length;
  const totalInterfaces = interfaces.length;
  const totalBandwidth = interfaces.reduce((sum, i) => sum + (i.speed || 0), 0);
  const errors = interfaces.reduce((sum, i) => sum + (i.inErrors || 0) + (i.outErrors || 0), 0);
  const discards = interfaces.reduce((sum, i) => sum + (i.inDiscards || 0) + (i.outDiscards || 0), 0);

  // Calculate total packets
  const totalInPackets = interfaces.reduce((sum, i) => sum + (i.inPackets || 0), 0);
  const totalOutPackets = interfaces.reduce((sum, i) => sum + (i.outPackets || 0), 0);

  // Format for frontend - matching expected field names
  res.json({
    cpu: snmpMetrics.cpu_usage || 0,
    memory: snmpMetrics.memory_percent || 0,
    temperature: null, // Temperature not available via standard SNMP
    memoryTotal: snmpMetrics.memory_total || 0,
    memoryUsed: snmpMetrics.memory_used || 0,
    uptime: snmpMetrics.uptime || 0,
    interfaces: interfaces,
    activeInterfaces: activeInterfaces,
    totalInterfaces: totalInterfaces,
    bandwidth: totalBandwidth,
    errors: errors,
    discards: discards,
    totalInPackets: totalInPackets,
    totalOutPackets: totalOutPackets,
    systemInfo: systemInfo,
    timestamp: snmpMetrics.timestamp
  });
});

app.get('/api/monitoring/:siteId/meraki', requireAuth, apiLimiter, async (req, res) => {
  try {
    const site = db.prepare('SELECT ip, api_key FROM sites WHERE id = ? AND user_id = ?')
      .get(req.params.siteId, req.session.userId);

    if (!site || !site.api_key) {
      return res.json({ error: 'No API key configured' });
    }

    const merakiMetrics = await monitoring.getMerakiMetrics(site.ip, site.api_key);

    if (merakiMetrics && !merakiMetrics.error) {
      // Map Meraki API response to frontend expected format
      const uplinks = merakiMetrics.uplinks || [];
      const primaryWan = uplinks.find(u => u.interface === 'WAN 1' || u.interface === 'wan1');
      const failoverWan = uplinks.find(u => u.interface === 'WAN 2' || u.interface === 'wan2');

      const uplinkSummary = uplinks.map(uplink => ({
        interface: uplink.interface,
        status: uplink.status,
        ip: uplink.ip || uplink.publicIp || null,
        publicIp: uplink.publicIp || null,
        gateway: uplink.gateway || null,
        lastReportedAt: uplink.lastReportedAt || null,
        latencyMs: uplink.latencyMs !== undefined ? uplink.latencyMs : null,
        lossPercent: uplink.lossPercent !== undefined ? uplink.lossPercent : null
      }));

      const performance = merakiMetrics.performance || null;
      const trafficSummary = Array.isArray(merakiMetrics.traffic)
        ? merakiMetrics.traffic.slice(0, 5).map(item => ({
            application: item.application || item.destination || item.protocol || 'Unknown',
            protocol: item.protocol || null,
            sent: item.sent || 0,
            recv: item.recv || 0,
            total: (item.sent || 0) + (item.recv || 0),
            numClients: item.numClients || 0
          }))
        : [];

      res.json({
        status: merakiMetrics.device?.status || 'unknown',
        clients: merakiMetrics.activeClients || 0,
        publicIp: merakiMetrics.device?.publicIp || primaryWan?.publicIp || null,
        device: {
          name: merakiMetrics.device?.name || null,
          model: merakiMetrics.device?.model || null,
          serial: merakiMetrics.device?.serial || null,
          productType: merakiMetrics.device?.productType || null,
          mac: merakiMetrics.device?.mac || null,
          lanIp: merakiMetrics.device?.lanIp || null,
          firmware: merakiMetrics.device?.firmware || null
        },
        networkName: merakiMetrics.network?.name,
        network: merakiMetrics.network || null,
        uplinks: uplinkSummary,
        primaryWan: primaryWan ? {
          interface: primaryWan.interface,
          status: primaryWan.status,
          ip: primaryWan.ip || primaryWan.publicIp || null,
          latencyMs: primaryWan.latencyMs !== undefined ? primaryWan.latencyMs : null,
          lossPercent: primaryWan.lossPercent !== undefined ? primaryWan.lossPercent : null
        } : null,
        failoverWan: failoverWan ? {
          interface: failoverWan.interface,
          status: failoverWan.status,
          ip: failoverWan.ip || failoverWan.publicIp || null,
          latencyMs: failoverWan.latencyMs !== undefined ? failoverWan.latencyMs : null,
          lossPercent: failoverWan.lossPercent !== undefined ? failoverWan.lossPercent : null
        } : null,
        performance,
        trafficSummary,
        topApplication: trafficSummary.length > 0 ? trafficSummary[0].application : null,
        timestamp: merakiMetrics.timestamp
      });
    } else {
      res.json(merakiMetrics || {});
    }
  } catch (err) {
    console.error('Meraki API error:', err);
    res.json({ error: err.message });
  }
});

// Meraki device actions
const merakiApi = require('./meraki-api');

app.post('/api/meraki/:siteId/reboot', requireAuth, apiLimiter, async (req, res) => {
  try {
    const site = db.prepare('SELECT ip, api_key FROM sites WHERE id = ? AND user_id = ?')
      .get(req.params.siteId, req.session.userId);

    if (!site || !site.api_key) {
      return res.json({ error: 'No API key configured' });
    }

    const deviceInfo = await merakiApi.findDeviceByIp(site.api_key, site.ip);
    if (!deviceInfo) {
      return res.json({ error: 'Device not found' });
    }

    const result = await merakiApi.rebootDevice(site.api_key, deviceInfo.device.serial);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Reboot error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meraki/:siteId/blink', requireAuth, apiLimiter, async (req, res) => {
  try {
    const site = db.prepare('SELECT ip, api_key FROM sites WHERE id = ? AND user_id = ?')
      .get(req.params.siteId, req.session.userId);

    if (!site || !site.api_key) {
      return res.json({ error: 'No API key configured' });
    }

    const deviceInfo = await merakiApi.findDeviceByIp(site.api_key, site.ip);
    if (!deviceInfo) {
      return res.json({ error: 'Device not found' });
    }

    const result = await merakiApi.blinkDeviceLeds(site.api_key, deviceInfo.device.serial);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Blink error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ SITE ROUTES ============

app.get('/api/sites', requireAuth, apiLimiter, (req, res) => {
  const sites = db.prepare('SELECT * FROM sites WHERE user_id = ?').all(req.session.userId);
  res.json(sites);
});

app.get('/api/sites/export', requireAuth, apiLimiter, (req, res) => {
  const sites = db.prepare(`
    SELECT
      id,
      customer,
      name,
      ip,
      failover_ip,
      location,
      latitude,
      longitude,
      devices,
      status,
      isp,
      device,
      monitoring_icmp,
      monitoring_snmp,
      monitoring_api,
      snmp_community,
      api_key,
      api_endpoint,
      created_at
    FROM sites
    WHERE user_id = ?
    ORDER BY id
  `).all(req.session.userId);

  res.json({ sites });
});

app.post('/api/sites', requireAuth, apiLimiter, (req, res) => {
  const { customer, name, ip, failover_ip, location, latitude, longitude, devices, status, isp, device, monitoring_icmp, monitoring_snmp, monitoring_api, snmp_community, api_key, api_endpoint } = req.body;
  const monitoringNetflow = 0;
  const netflowPort = null;
  const result = db.prepare(
    'INSERT INTO sites (user_id, customer, name, ip, failover_ip, location, latitude, longitude, devices, status, isp, device, monitoring_icmp, monitoring_snmp, monitoring_netflow, monitoring_api, snmp_community, netflow_port, api_key, api_endpoint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.session.userId,
    customer,
    name,
    ip,
    failover_ip || null,
    location || null,
    latitude || null,
    longitude || null,
    devices,
    status,
    isp,
    device,
    monitoring_icmp ? 1 : 0,
    monitoring_snmp ? 1 : 0,
    monitoringNetflow,
    monitoring_api ? 1 : 0,
    snmp_community || null,
    netflowPort,
    api_key || null,
    api_endpoint || null
  );

  const siteId = result.lastInsertRowid;

  // Start monitoring this site
  const snmpCommunity = monitoring_snmp ? snmp_community : null;
  monitoring.startMonitoring(siteId, ip, failover_ip || null, snmpCommunity);

  res.json({
    id: siteId,
    customer,
    name,
    ip,
    failover_ip: failover_ip || null,
    location: location || null,
    latitude: latitude || null,
    longitude: longitude || null,
    devices,
    status,
    isp,
    device,
    monitoring_icmp: !!monitoring_icmp,
    monitoring_snmp: !!monitoring_snmp,
    monitoring_netflow: false,
    monitoring_api: !!monitoring_api,
    snmp_community: snmp_community || null,
    netflow_port: netflowPort,
    api_key: api_key || null,
    api_endpoint: api_endpoint || null
  });
});

app.post('/api/sites/import', requireAuth, apiLimiter, (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : req.body?.sites;

  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ error: 'No sites provided for import' });
  }

  const userId = req.session.userId;
  const summary = { created: 0, updated: 0, skipped: 0, errors: [] };
  const restartQueue = [];

  const insertStmt = db.prepare(`
    INSERT INTO sites (
      user_id, customer, name, ip, failover_ip, location, latitude, longitude,
      devices, status, isp, device, monitoring_icmp, monitoring_snmp,
      monitoring_netflow, monitoring_api, snmp_community, netflow_port,
      api_key, api_endpoint
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE sites SET
      customer = ?, name = ?, ip = ?, failover_ip = ?, location = ?, latitude = ?, longitude = ?,
      devices = ?, status = ?, isp = ?, device = ?, monitoring_icmp = ?, monitoring_snmp = ?,
      monitoring_netflow = 0, monitoring_api = ?, snmp_community = ?, netflow_port = NULL,
      api_key = ?, api_endpoint = ?
    WHERE id = ? AND user_id = ?
  `);

  const selectByIdStmt = db.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?');
  const selectByIpStmt = db.prepare('SELECT id FROM sites WHERE user_id = ? AND ip = ?');

  const toBool = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 'enabled', 'on'].includes(normalized);
    }
    return !!value;
  };

  const cleanString = (value) => {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    return str.length === 0 ? null : str;
  };

  const parseNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const importTransaction = db.transaction((sitesData) => {
    sitesData.forEach((site, index) => {
      const customer = cleanString(site.customer) || '';
      const name = cleanString(site.name) || '';
      const ip = cleanString(site.ip) || '';

      if (!customer || !name || !ip) {
        summary.skipped += 1;
        summary.errors.push(`Entry ${index + 1}: Missing required fields (customer, name, ip).`);
        return;
      }

      const failoverIp = cleanString(site.failover_ip);
      const location = cleanString(site.location);
      const latitude = parseNumber(site.latitude);
      const longitude = parseNumber(site.longitude);
      const devices = cleanString(site.devices);
      const status = cleanString(site.status) || 'Operational';
      const isp = cleanString(site.isp);
      const device = cleanString(site.device) || 'Router';
      const monitoringIcmp = toBool(site.monitoring_icmp) ? 1 : 0;
      const monitoringSnmp = toBool(site.monitoring_snmp) ? 1 : 0;
      const monitoringApi = toBool(site.monitoring_api) ? 1 : 0;
      const snmpCommunity = cleanString(site.snmp_community);
      const apiKey = cleanString(site.api_key);
      const apiEndpoint = cleanString(site.api_endpoint);

      let targetId = null;

      if (site.id !== undefined && site.id !== null) {
        const existing = selectByIdStmt.get(site.id, userId);
        if (existing) {
          targetId = existing.id;
        }
      }

      if (!targetId) {
        const existingByIp = selectByIpStmt.get(userId, ip);
        if (existingByIp) {
          targetId = existingByIp.id;
        }
      }

      if (targetId) {
        updateStmt.run(
          customer,
          name,
          ip,
          failoverIp,
          location,
          latitude,
          longitude,
          devices,
          status,
          isp,
          device,
          monitoringIcmp,
          monitoringSnmp,
          monitoringApi,
          snmpCommunity,
          apiKey,
          apiEndpoint,
          targetId,
          userId
        );

        summary.updated += 1;
        restartQueue.push({
          id: targetId,
          ip,
          failover_ip: failoverIp,
          monitoring_snmp: !!monitoringSnmp,
          snmp_community: snmpCommunity
        });
      } else {
        const result = insertStmt.run(
          userId,
          customer,
          name,
          ip,
          failoverIp,
          location,
          latitude,
          longitude,
          devices,
          status,
          isp,
          device,
          monitoringIcmp,
          monitoringSnmp,
          monitoringApi,
          snmpCommunity,
          apiKey,
          apiEndpoint
        );

        const newId = result.lastInsertRowid;
        summary.created += 1;
        restartQueue.push({
          id: newId,
          ip,
          failover_ip: failoverIp,
          monitoring_snmp: !!monitoringSnmp,
          snmp_community: snmpCommunity
        });
      }
    });
  });

  try {
    importTransaction(payload);
  } catch (err) {
    console.error('Failed to import sites:', err);
    return res.status(500).json({ error: 'Failed to import sites' });
  }

  restartQueue.forEach(site => {
    try {
      monitoring.stopMonitoring(site.id);
      const snmpCommunityValue = site.monitoring_snmp ? (site.snmp_community || null) : null;
      monitoring.startMonitoring(site.id, site.ip, site.failover_ip || null, snmpCommunityValue);
    } catch (err) {
      console.error(`Failed to restart monitoring for site ${site.id}:`, err);
    }
  });

  res.json({
    success: true,
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    errors: summary.errors
  });
});

app.put('/api/sites/:id', requireAuth, apiLimiter, (req, res) => {
  const { customer, name, ip, failover_ip, location, latitude, longitude, devices, isp, device, monitoring_icmp, monitoring_snmp, monitoring_api, snmp_community, api_key, api_endpoint } = req.body;
  const monitoringNetflow = 0;
  const netflowPort = null;

  db.prepare(
    'UPDATE sites SET customer = ?, name = ?, ip = ?, failover_ip = ?, location = ?, latitude = ?, longitude = ?, devices = ?, isp = ?, device = ?, monitoring_icmp = ?, monitoring_snmp = ?, monitoring_netflow = ?, monitoring_api = ?, snmp_community = ?, netflow_port = ?, api_key = ?, api_endpoint = ? WHERE id = ? AND user_id = ?'
  ).run(
    customer,
    name,
    ip,
    failover_ip || null,
    location || null,
    latitude || null,
    longitude || null,
    devices,
    isp,
    device,
    monitoring_icmp ? 1 : 0,
    monitoring_snmp ? 1 : 0,
    monitoringNetflow,
    monitoring_api ? 1 : 0,
    snmp_community || null,
    netflowPort,
    api_key || null,
    api_endpoint || null,
    req.params.id,
    req.session.userId
  );

  // Restart monitoring with updated IPs
  monitoring.stopMonitoring(req.params.id);
  const snmpCommunity = monitoring_snmp ? snmp_community : null;
  monitoring.startMonitoring(req.params.id, ip, failover_ip || null, snmpCommunity);

  res.json({ success: true });
});

app.delete('/api/sites/:id', requireAuth, apiLimiter, (req, res) => {
  // Stop monitoring before deleting
  monitoring.stopMonitoring(req.params.id);

  db.prepare('DELETE FROM sites WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ success: true });
});

app.delete('/api/sites', requireAuth, apiLimiter, (req, res) => {
  // Stop all monitoring
  const sites = db.prepare('SELECT id FROM sites WHERE user_id = ?').all(req.session.userId);
  sites.forEach(site => monitoring.stopMonitoring(site.id));

  db.prepare('DELETE FROM sites WHERE user_id = ?').run(req.session.userId);
  res.json({ success: true });
});

// ============ PRESET ROUTES ============

app.get('/api/presets', requireAuth, apiLimiter, (req, res) => {
  const presets = db.prepare('SELECT * FROM presets WHERE user_id = ?').all(req.session.userId);
  res.json(presets.map(p => ({ ...p, sites: JSON.parse(p.sites) })));
});

app.post('/api/presets', requireAuth, apiLimiter, (req, res) => {
  const { name, description, sites } = req.body;
  const result = db.prepare(
    'INSERT INTO presets (user_id, name, description, sites) VALUES (?, ?, ?, ?)'
  ).run(req.session.userId, name, description, JSON.stringify(sites));

  res.json({ id: result.lastInsertRowid, name, description, sites });
});

app.put('/api/presets/:id', requireAuth, apiLimiter, (req, res) => {
  const { name, description, sites } = req.body;
  db.prepare(
    'UPDATE presets SET name = ?, description = ?, sites = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
  ).run(name, description, JSON.stringify(sites), req.params.id, req.session.userId);

  res.json({ success: true });
});

app.delete('/api/presets/:id', requireAuth, apiLimiter, (req, res) => {
  db.prepare('DELETE FROM presets WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ success: true });
});

// ============ USER MANAGEMENT ROUTES ============

app.get('/api/users', requireAuth, apiLimiter, (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, active, created_at FROM users').all();
  res.json(users);
});

app.post('/api/users', requireAuth, apiLimiter, async (req, res) => {
  try {
    const { username, email, role, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email exists (if provided)
    if (email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, email, password, role, active) VALUES (?, ?, ?, ?, ?)'
    ).run(username, email || null, hashedPassword, role || 'viewer', 1);

    res.json({
      id: result.lastInsertRowid,
      username,
      email: email || null,
      role: role || 'viewer',
      active: true,
      created_at: Date.now()
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireAuth, apiLimiter, async (req, res) => {
  try {
    const { username, email, role, password, active } = req.body;
    const userId = parseInt(req.params.id);

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    // Check if username exists (excluding current user)
    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email exists (excluding current user)
    if (email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user (without password if not provided)
    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      db.prepare(
        'UPDATE users SET username = ?, email = ?, role = ?, active = ?, password = ? WHERE id = ?'
      ).run(username, email || null, role, active ? 1 : 0, hashedPassword, userId);
    } else {
      db.prepare(
        'UPDATE users SET username = ?, email = ?, role = ?, active = ? WHERE id = ?'
      ).run(username, email || null, role, active ? 1 : 0, userId);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', requireAuth, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting the last admin
    const admins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = 1").get();
    const userToDelete = db.prepare('SELECT role, active FROM users WHERE id = ?').get(userId);

    if (userToDelete && userToDelete.role === 'admin' && userToDelete.active === 1 && admins.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last active admin user' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============ AUDIT LOG ROUTES ============

app.get('/api/audit', requireAuth, apiLimiter, (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500')
    .all(req.session.userId);
  res.json(logs);
});

app.post('/api/audit', requireAuth, apiLimiter, (req, res) => {
  const { type, site_id, site_name, customer, message, severity } = req.body;
  db.prepare(
    'INSERT INTO audit_log (user_id, type, site_id, site_name, customer, message, severity) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.session.userId, type, site_id, site_name, customer, message, severity);

  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'dist' });
  });
}

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.listen(PORT, () => {
  console.log(`🔒 NOCTURNAL Server running on port ${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
  if (isProduction) {
    console.log(`Access at: http://localhost:${PORT}`);
  }

  // Start monitoring for all sites on server start
  const allSites = db.prepare('SELECT id, ip, failover_ip, monitoring_snmp, snmp_community FROM sites').all();
  allSites.forEach(site => {
    const snmpCommunity = site.monitoring_snmp ? site.snmp_community : null;
    monitoring.startMonitoring(site.id, site.ip, site.failover_ip, snmpCommunity);
  });
  console.log(`📡 Monitoring ${allSites.length} sites`);
});
