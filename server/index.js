const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');
// Trigger restart
require('dotenv').config();

const prisma = require('./prisma');
const authRoutes = require('./auth/routes');
const merakiRoutes = require('./routes/meraki');
const toolsRoutes = require('./routes/tools');
const cardConfigRoutes = require('./routes/card-config');
const secretsRoutes = require('./routes/secrets');
const { requireAuth } = require('./auth/middleware');
const monitoring = require('./monitoring');
const limits = require('./limits');
const cache = require('./cache');
const app = express();
const server = http.createServer(app);

// Determine CORS origin configuration
const isProduction = process.env.NODE_ENV === 'production';
let corsOrigin;

if (process.env.CLIENT_URL) {
  // Explicit CLIENT_URL set - use it
  corsOrigin = process.env.CLIENT_URL;
} else if (isProduction) {
  // Production without CLIENT_URL - allow all origins (with warning)
  console.warn('⚠️  WARNING: CLIENT_URL not set in production. Allowing all origins.');
  corsOrigin = true; // Allow all origins
} else {
  // Development default
  corsOrigin = 'http://localhost:3001';
}

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: corsOrigin === true ? '*' : corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Pass io instance to monitoring module
monitoring.setIo(io);

io.on('connection', (socket) => {
  // console.log('Client connected to WebSocket:', socket.id);
  socket.on('disconnect', () => {
    // console.log('Client disconnected:', socket.id);
  });
});

// Security middleware - MINIMAL for HTTP-only operation
app.use(helmet({
  contentSecurityPolicy: false,  // Disable CSP to avoid any upgrade issues
  hsts: false,  // No HSTS - required for HTTP-only operation
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false
}));

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

app.use(compression()); // Enable gzip compression for performance
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting - disabled for local database (unlimited)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100000 // Effectively unlimited for local database
});

// Auth routes (register, login, refresh, logout)
app.use('/api/auth', authRoutes);

// Meraki routes (devices, configuration, management)
app.use('/api/meraki', merakiRoutes);

// Tools routes (ping, traceroute)
app.use('/api/tools', toolsRoutes);

// Card Configuration routes
app.use('/api/card-config', requireAuth, cardConfigRoutes);

// Secrets & Keys routes
app.use('/api/secrets', requireAuth, secretsRoutes);

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ LIMITS & USAGE STATS ============
app.get('/api/limits/usage', requireAuth, async (req, res) => {
  try {
    const stats = await limits.getUsageStats();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get usage stats' });
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
    let response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'NOCTURNAL-NOC-Dashboard/1.0'
        }
      }
    );
    let data = await response.json();

    // If no results, try parsing and simplifying the address
    if (!data || data.length === 0) {
      const parts = address.split(',').map(p => p.trim());
      if (parts.length >= 2) {
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

// ============ SITES ROUTES ============
app.get('/api/sites', requireAuth, async (req, res) => {
  try {
    // Cache site list
    const sites = await cache.getOrSet(
      cache.CACHE_KEYS.SITES + 'all',
      cache.TTL.SITES,
      () => prisma.site.findMany({ orderBy: { createdAt: 'desc' } })
    );
    res.json(sites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

app.post('/api/sites', requireAuth, async (req, res) => {
  try {
    const d = req.body;

    // Parse monitoringInterval - ensure it's a valid number, default to 60 if invalid
    const monitoringInterval = d.monitoringInterval !== undefined && d.monitoringInterval !== null
      ? Math.max(1, parseInt(d.monitoringInterval) || 60) // Minimum 1 second, default 60
      : 60;

    // Local database - no storage limits
    const site = await prisma.site.create({
      data: {
        name: d.name, customer: d.customer, location: d.location, ip: d.ip,
        failoverIp: d.failover_ip || null, latitude: d.latitude || null, longitude: d.longitude || null,
        isp: d.isp || null, device: d.device || null, devices: d.devices || null,
        monitoringIcmp: d.monitoring_icmp ?? true, monitoringSnmp: d.monitoring_snmp ?? false,
        snmpCommunity: d.snmp_community || null, snmpOid: d.snmp_oid || null,
        monitoringNetflow: d.monitoring_netflow ?? false, monitoringMeraki: d.monitoring_meraki ?? false,
        apiKey: d.api_key || null, notes: d.notes || null, status: 'unknown',
        monitoringInterval: monitoringInterval
      }
    });
    if (site.monitoringIcmp) monitoring.startMonitoring(site.id, site.ip, site.failoverIp, site.monitoringSnmp ? site.snmpCommunity : null, site.monitoringInterval);

    // Local database - no limits
    await prisma.auditLog.create({ data: { userId: req.user.userId, action: 'site_created', details: { siteId: site.id, siteName: site.name } } });
    res.json(site);
  } catch (error) {
    console.error(error);
    if (error.message && error.message.includes('Storage limit exceeded')) {
      res.status(507).json({ error: error.message }); // 507 Insufficient Storage
    } else {
      res.status(500).json({ error: 'Failed to create site' });
    }
  }
});

app.put('/api/sites/:id', requireAuth, async (req, res) => {
  try {
    const d = req.body;
    
    // Parse monitoringInterval - ensure it's a valid number, default to 60 if invalid
    const monitoringInterval = d.monitoringInterval !== undefined && d.monitoringInterval !== null
      ? Math.max(1, parseInt(d.monitoringInterval) || 60) // Minimum 1 second, default 60
      : 60;
    
    const site = await prisma.site.update({
      where: { id: req.params.id },
      data: {
        name: d.name, customer: d.customer, location: d.location, ip: d.ip,
        failoverIp: d.failover_ip || null, latitude: d.latitude || null, longitude: d.longitude || null,
        isp: d.isp || null, device: d.device || null, devices: d.devices || null,
        monitoringIcmp: d.monitoring_icmp ?? true, monitoringSnmp: d.monitoring_snmp ?? false,
        snmpCommunity: d.snmp_community || null, snmpOid: d.snmp_oid || null,
        monitoringNetflow: d.monitoring_netflow ?? false, monitoringMeraki: d.monitoring_meraki ?? false,
        apiKey: d.api_key || null, notes: d.notes || null,
        monitoringInterval: monitoringInterval
      }
    });
    
    // Invalidate site cache
    cache.invalidateSite(site.id);
    
    // ALWAYS stop monitoring first to clear any existing interval
    monitoring.stopMonitoring(site.id);
    
    // Then restart monitoring if ICMP monitoring is enabled
    if (site.monitoringIcmp) {
      const snmpCommunity = site.monitoringSnmp ? site.snmpCommunity : null;
      monitoring.startMonitoring(site.id, site.ip, site.failoverIp, snmpCommunity, site.monitoringInterval);
      console.log(`[Site Update] Restarted monitoring for site ${site.id} with interval ${site.monitoringInterval}s`);
    } else {
      console.log(`[Site Update] Monitoring disabled for site ${site.id}`);
    }
    
    await prisma.auditLog.create({ data: { userId: req.user.userId, action: 'site_updated', details: { siteId: site.id, siteName: site.name, monitoringInterval: site.monitoringInterval } } });
    res.json(site);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

app.delete('/api/sites/:id', requireAuth, async (req, res) => {
  try {
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) return res.status(404).json({ error: 'Not found' });
    monitoring.stopMonitoring(req.params.id);
    await prisma.site.delete({ where: { id: req.params.id } });
    
    // Invalidate site cache
    cache.invalidateSite(req.params.id);
    
    await prisma.auditLog.create({ data: { userId: req.user.userId, action: 'site_deleted', details: { siteId: req.params.id, siteName: site.name } } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.delete('/api/sites', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    ids.forEach(id => monitoring.stopMonitoring(id));
    await prisma.site.deleteMany({ where: { id: { in: ids } } });
    
    // Invalidate site cache for all deleted sites
    ids.forEach(id => cache.invalidateSite(id));
    cache.invalidateSites();
    
    await prisma.auditLog.create({ data: { userId: req.user.userId, action: 'sites_bulk_deleted', details: { siteIds: ids, count: ids.length } } });
    res.json({ message: `${ids.length} deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Export Sites
app.get('/api/sites/export', requireAuth, async (req, res) => {
  try {
    // Use cached site list
    const sites = await cache.getOrSet(
      cache.CACHE_KEYS.SITES + 'all',
      cache.TTL.SITES,
      () => prisma.site.findMany({ orderBy: { createdAt: 'desc' } })
    );

    res.json({ sites });
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({ error: 'Failed to export sites' });
  }
});

// Import Sites
app.post('/api/sites/import', requireAuth, async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.sites;

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ error: 'No sites provided for import' });
    }

    const userId = req.user.userId;
    const summary = { created: 0, updated: 0, skipped: 0, errors: [] };
    const restartQueue = [];

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

    for (let i = 0; i < payload.length; i++) {
      const site = payload[i];
      const customer = cleanString(site.customer) || '';
      const name = cleanString(site.name) || '';
      const ip = cleanString(site.ip) || '';

      if (!customer || !name || !ip) {
        summary.skipped += 1;
        summary.errors.push(`Entry ${i + 1}: Missing required fields (customer, name, ip).`);
        continue;
      }

      const siteData = {
        customer,
        name,
        ip,
        failoverIp: cleanString(site.failoverIp || site.failover_ip),
        location: cleanString(site.location),
        latitude: parseNumber(site.latitude),
        longitude: parseNumber(site.longitude),
        isp: cleanString(site.isp),
        device: cleanString(site.device) || null,
        devices: cleanString(site.devices),
        monitoringIcmp: toBool(site.monitoringIcmp ?? site.monitoring_icmp ?? true),
        monitoringSnmp: toBool(site.monitoringSnmp ?? site.monitoring_snmp ?? false),
        snmpCommunity: cleanString(site.snmpCommunity || site.snmp_community),
        snmpOid: cleanString(site.snmpOid || site.snmp_oid),
        monitoringNetflow: toBool(site.monitoringNetflow ?? site.monitoring_netflow ?? false),
        monitoringMeraki: toBool(site.monitoringMeraki ?? site.monitoring_meraki ?? false),
        apiKey: cleanString(site.apiKey || site.api_key),
        notes: cleanString(site.notes),
        status: cleanString(site.status) || 'unknown'
      };

      try {
        let targetId = null;
        let existingSite = null;

        // Check by ID first
        if (site.id) {
          existingSite = await prisma.site.findUnique({
            where: { id: site.id }
          });
          if (existingSite) targetId = existingSite.id;
        }

        // Check by IP if not found by ID
        if (!targetId) {
          existingSite = await prisma.site.findFirst({
            where: { ip }
          });
          if (existingSite) targetId = existingSite.id;
        }

        if (targetId) {
          // Update existing
          const updatedSite = await prisma.site.update({
            where: { id: targetId },
            data: siteData
          });
          summary.updated += 1;
          restartQueue.push({ id: targetId, ip, failoverIp: siteData.failoverIp, monitoringIcmp: siteData.monitoringIcmp, monitoringSnmp: siteData.monitoringSnmp, snmpCommunity: siteData.snmpCommunity, monitoringInterval: updatedSite.monitoringInterval || 60 });
        } else {
          // Local database - no storage limits
          const newSite = await prisma.site.create({ data: siteData });
          summary.created += 1;
          restartQueue.push({ id: newSite.id, ip, failoverIp: siteData.failoverIp, monitoringIcmp: siteData.monitoringIcmp, monitoringSnmp: siteData.monitoringSnmp, snmpCommunity: siteData.snmpCommunity, monitoringInterval: newSite.monitoringInterval || 60 });
        }
      } catch (err) {
        summary.skipped += 1;
        summary.errors.push(`Entry ${i + 1}: ${err.message}`);
      }
    }

    // Restart monitoring for affected sites
    restartQueue.forEach(item => {
      monitoring.stopMonitoring(item.id);
      if (item.monitoringIcmp) {
        monitoring.startMonitoring(item.id, item.ip, item.failoverIp, item.monitoringSnmp ? item.snmpCommunity : null, item.monitoringInterval || 60);
      }
    });

    // Invalidate site cache after import
    cache.invalidateSites();

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'sites_imported',
        details: { created: summary.created, updated: summary.updated, skipped: summary.skipped }
      }
    });

    res.json(summary);
  } catch (error) {
    console.error('Import failed:', error);
    res.status(500).json({ error: 'Failed to import sites' });
  }
});

// ============ MONITORING ROUTES ============
app.get('/api/monitoring/:siteId', requireAuth, async (req, res) => {
  try {
    // Cache latest monitoring data
    const data = await cache.getOrSet(
      cache.CACHE_KEYS.MONITORING_LATEST + req.params.siteId,
      cache.TTL.MONITORING_LATEST,
      () => prisma.monitoringData.findFirst({ 
        where: { siteId: req.params.siteId }, 
        orderBy: { timestamp: 'desc' } 
      })
    );
    res.json(data || { latency: null, packetLoss: null, jitter: null, timestamp: null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/monitoring/:siteId/history', requireAuth, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    
    // Cache history with hours as part of key
    // Increase TTL for history to reducing load
    const cacheKey = `${cache.CACHE_KEYS.MONITORING_HISTORY}${req.params.siteId}:${hours}`;
    const history = await cache.getOrSet(
      cacheKey,
      60, // 60 seconds cache for history
      async () => {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        
        // Fetch raw data
        const data = await prisma.monitoringData.findMany({ 
          where: { siteId: req.params.siteId, timestamp: { gte: since } }, 
          orderBy: { timestamp: 'asc' } 
        });

        // Downsample if data points > 500 to reduce payload size
        if (data.length > 500) {
          const factor = Math.ceil(data.length / 500);
          return data.filter((_, i) => i % factor === 0);
        }
        return data;
      }
    );
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/monitoring/:siteId/snmp', requireAuth, async (req, res) => {
  try {
    // Cache latest SNMP data
    const data = await cache.getOrSet(
      cache.CACHE_KEYS.SNMP_LATEST + req.params.siteId,
      cache.TTL.SNMP_LATEST,
      () => prisma.snmpData.findFirst({ 
        where: { siteId: req.params.siteId }, 
        orderBy: { timestamp: 'desc' } 
      })
    );
    res.json(data || { cpuUsage: null, memoryUsage: null, uptime: null, interfaceStats: null, timestamp: null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch SNMP' });
  }
});

app.get('/api/monitoring/:siteId/netflow', requireAuth, (req, res) => {
  res.json({ message: 'NetFlow coming soon' });
});

app.get('/api/monitoring/:siteId/meraki', requireAuth, async (req, res) => {
  try {
    // Cache site lookup
    const site = await cache.getOrSet(
      cache.CACHE_KEYS.SITE + req.params.siteId,
      cache.TTL.SITE,
      () => prisma.site.findUnique({ where: { id: req.params.siteId } })
    );
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (!site.monitoringMeraki || !site.apiKey) {
      return res.json({ error: 'Meraki monitoring not enabled or API key missing' });
    }

    const merakiApi = require('./meraki-api');
    const metrics = await merakiApi.getDeviceMetrics(site.apiKey, site.ip);
    res.json(metrics);
  } catch (error) {
    console.error('Meraki API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRESETS ROUTES ============
app.get('/api/presets', requireAuth, async (req, res) => {
  try {
    // Cache presets list
    const presets = await cache.getOrSet(
      cache.CACHE_KEYS.PRESETS + 'all',
      cache.TTL.PRESETS,
      () => prisma.preset.findMany({ orderBy: { createdAt: 'desc' } })
    );
    res.json(presets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});

app.post('/api/presets', requireAuth, async (req, res) => {
  try {
    // Local database - no storage limits
    const preset = await prisma.preset.create({ data: { name: req.body.name, config: req.body.config } });
    
    // Invalidate presets cache
    cache.delPattern(cache.CACHE_KEYS.PRESETS);
    
    res.json(preset);
  } catch (error) {
    console.error(error);
    if (error.message && error.message.includes('Storage limit exceeded')) {
      res.status(507).json({ error: error.message }); // 507 Insufficient Storage
    } else {
      res.status(500).json({ error: 'Failed to create preset' });
    }
  }
});

app.put('/api/presets/:id', requireAuth, async (req, res) => {
  try {
    const preset = await prisma.preset.update({ where: { id: req.params.id }, data: { name: req.body.name, config: req.body.config } });
    res.json(preset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update preset' });
  }
});

app.delete('/api/presets/:id', requireAuth, async (req, res) => {
  try {
    await prisma.preset.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ============ AUDIT LOG ROUTES ============
app.get('/api/audit', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await prisma.auditLog.findMany({ take: limit, orderBy: { timestamp: 'desc' }, include: { user: { select: { email: true, firstName: true, lastName: true } } } });
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.post('/api/audit', requireAuth, async (req, res) => {
  try {
    // Local database - no storage limits
    const log = await prisma.auditLog.create({ data: { userId: req.user.userId, action: req.body.action, details: req.body.details || {} } });
    res.json(log);
  } catch (error) {
    console.error(error);
    if (error.message && error.message.includes('Storage limit exceeded')) {
      res.status(507).json({ error: error.message }); // 507 Insufficient Storage
    } else {
      res.status(500).json({ error: 'Failed to create log' });
    }
  }
});

// ============ USER MANAGEMENT ROUTES ============
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', requireAuth, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Local database - no storage limits
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || 'user'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    // Local database - no limits
    await prisma.auditLog.create({ data: { userId: req.user.userId, action: 'user_created', details: { userId: user.id, email: user.email } } });
    res.json(user);
  } catch (error) {
    console.error(error);
    if (error.message && error.message.includes('Storage limit exceeded')) {
      res.status(507).json({ error: error.message }); // 507 Insufficient Storage
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    const userId = req.params.id;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Check if email exists (excluding current user)
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: userId }
      }
    });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const updateData = {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      role: role || 'user'
    };

    // Update password if provided
    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 12);
      updateData.password = hashedPassword;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true
      }
    });

    await prisma.auditLog.create({ data: { userId: req.user.userId, action: 'user_updated', details: { userId: user.id, email: user.email } } });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting yourself
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Check if this is the last admin
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    const userToDelete = await prisma.user.findUnique({ where: { id: userId } });

    if (userToDelete?.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }

    await prisma.user.delete({ where: { id: userId } });
    await prisma.auditLog.create({ data: { userId: req.user.userId, action: 'user_deleted', details: { userId, email: userToDelete?.email } } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files with proper headers
  app.use(express.static('dist', {
    setHeaders: (res, path) => {
      // Force HTTP, prevent any HTTPS upgrades
      res.removeHeader('Strict-Transport-Security');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
  app.get('*', (req, res) => {
    res.removeHeader('Strict-Transport-Security');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile('dist/index.html', { root: '.' });
  });
}

server.listen(PORT, async () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize monitoring for all existing sites
  try {
    const sites = await prisma.site.findMany({
      where: { monitoringIcmp: true }
    });

    sites.forEach(site => {
      const snmpCommunity = site.monitoringSnmp ? site.snmpCommunity : null;
      const interval = site.monitoringInterval || 60;
      monitoring.startMonitoring(site.id, site.ip, site.failoverIp, snmpCommunity, interval);
    });

    console.log(`✓ Started monitoring ${sites.length} sites`);
  } catch (err) {
    // Check if it's a quota exceeded error
    const isQuotaError = err?.message?.includes('exceeded the data transfer quota') ||
                         err?.message?.includes('data transfer quota');
    
    if (isQuotaError) {
      console.error('⚠️  Database quota exceeded - monitoring initialization skipped');
      console.error('   Your Neon database has exceeded its monthly data transfer quota (5 GB).');
      console.error('   Please upgrade your plan or wait for the quota to reset monthly.');
    } else {
    console.error('Error initializing monitoring:', err.message);
    }
  }

  // Initialize limits monitoring and cleanup
  try {
    // Run initial cleanup (skip if quota exceeded)
    try {
    await limits.runAutomaticCleanup();
    } catch (err) {
      const isQuotaError = err?.message?.includes('exceeded the data transfer quota') ||
                           err?.message?.includes('data transfer quota');
      if (isQuotaError) {
        console.warn('⚠️  Skipping automatic cleanup - quota exceeded');
      } else {
        throw err;
      }
    }

    // Log current usage (skip if quota exceeded)
    let usage;
    try {
      usage = await limits.getUsageStats();
    } catch (err) {
      const isQuotaError = err?.message?.includes('exceeded the data transfer quota') ||
                           err?.message?.includes('data transfer quota');
      if (isQuotaError) {
        console.warn('⚠️  Skipping usage stats - quota exceeded');
        usage = null;
      } else {
        throw err;
      }
    }
    
    if (usage && usage.storage) {
      console.log(`✓ Storage usage: ${usage.storage.used} GB / ${usage.storage.limit} GB (${usage.storage.percentage.toFixed(1)}%)`);
      if (usage.storage.percentage > 80) {
        console.warn(`⚠️  WARNING: Storage usage is at ${usage.storage.percentage.toFixed(1)}% - consider cleanup`);
      }
    }

    // Run cleanup every 6 hours
    setInterval(async () => {
      await limits.runAutomaticCleanup();
    }, 6 * 60 * 60 * 1000);
  } catch (err) {
    console.error('Error initializing limits monitoring:', err.message);
  }
});
