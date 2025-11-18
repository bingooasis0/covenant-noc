const express = require('express');
const { clerkMiddleware, requireAuth: clerkRequireAuth, getAuth } = require('@clerk/express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { sql, initializeDatabase } = require('./db-neon');
const monitoring = require('./monitoring');
const app = express();

// Initialize database
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

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

// Clerk middleware for authentication
app.use(clerkMiddleware());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000 // 1000 requests per minute (increased for monitoring)
});

// Custom auth middleware to get userId from Clerk
const requireAuth = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
};

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Get all sites for the authenticated user
app.get('/api/sites', requireAuth, async (req, res) => {
  try {
    const sites = await sql`
      SELECT * FROM sites
      WHERE clerk_user_id = ${req.userId}
      ORDER BY created_at DESC
    `;
    res.json(sites);
  } catch (err) {
    console.error('Get sites error:', err);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Create new site
app.post('/api/sites', requireAuth, async (req, res) => {
  try {
    const {
      customer, name, ip, failover_ip, location, latitude, longitude,
      devices, status, isp, device, monitoring_icmp, monitoring_snmp,
      monitoring_netflow, monitoring_api, snmp_community, netflow_port,
      api_key, api_endpoint
    } = req.body;

    const result = await sql`
      INSERT INTO sites (
        clerk_user_id, customer, name, ip, failover_ip, location, latitude, longitude,
        devices, status, isp, device, monitoring_icmp, monitoring_snmp,
        monitoring_netflow, monitoring_api, snmp_community, netflow_port,
        api_key, api_endpoint
      ) VALUES (
        ${req.userId}, ${customer}, ${name}, ${ip}, ${failover_ip || null},
        ${location || null}, ${latitude || null}, ${longitude || null},
        ${devices || null}, ${status || 'operational'}, ${isp || null},
        ${device || null}, ${monitoring_icmp !== false}, ${monitoring_snmp === true},
        ${monitoring_netflow === true}, ${monitoring_api === true},
        ${snmp_community || null}, ${netflow_port || '2055'},
        ${api_key || null}, ${api_endpoint || null}
      )
      RETURNING *
    `;

    // Log audit entry
    await sql`
      INSERT INTO audit_log (clerk_user_id, type, site_id, site_name, customer, message, severity)
      VALUES (${req.userId}, 'site_created', ${result[0].id.toString()}, ${name}, ${customer},
              ${'Site created: ' + name}, 'info')
    `;

    res.json(result[0]);
  } catch (err) {
    console.error('Create site error:', err);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// Update site
app.put('/api/sites/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer, name, ip, failover_ip, location, latitude, longitude,
      devices, status, isp, device, monitoring_icmp, monitoring_snmp,
      monitoring_netflow, monitoring_api, snmp_community, netflow_port,
      api_key, api_endpoint
    } = req.body;

    // Verify ownership
    const existing = await sql`
      SELECT * FROM sites WHERE id = ${id} AND clerk_user_id = ${req.userId}
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const result = await sql`
      UPDATE sites SET
        customer = ${customer},
        name = ${name},
        ip = ${ip},
        failover_ip = ${failover_ip || null},
        location = ${location || null},
        latitude = ${latitude || null},
        longitude = ${longitude || null},
        devices = ${devices || null},
        status = ${status},
        isp = ${isp || null},
        device = ${device || null},
        monitoring_icmp = ${monitoring_icmp !== false},
        monitoring_snmp = ${monitoring_snmp === true},
        monitoring_netflow = ${monitoring_netflow === true},
        monitoring_api = ${monitoring_api === true},
        snmp_community = ${snmp_community || null},
        netflow_port = ${netflow_port || '2055'},
        api_key = ${api_key || null},
        api_endpoint = ${api_endpoint || null}
      WHERE id = ${id} AND clerk_user_id = ${req.userId}
      RETURNING *
    `;

    // Log audit entry
    await sql`
      INSERT INTO audit_log (clerk_user_id, type, site_id, site_name, customer, message, severity)
      VALUES (${req.userId}, 'site_updated', ${id}, ${name}, ${customer},
              ${'Site updated: ' + name}, 'info')
    `;

    res.json(result[0]);
  } catch (err) {
    console.error('Update site error:', err);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Delete site
app.delete('/api/sites/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get site info before deleting
    const site = await sql`
      SELECT * FROM sites WHERE id = ${id} AND clerk_user_id = ${req.userId}
    `;

    if (site.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    await sql`
      DELETE FROM sites WHERE id = ${id} AND clerk_user_id = ${req.userId}
    `;

    // Log audit entry
    await sql`
      INSERT INTO audit_log (clerk_user_id, type, site_id, site_name, customer, message, severity)
      VALUES (${req.userId}, 'site_deleted', ${id}, ${site[0].name}, ${site[0].customer},
              ${'Site deleted: ' + site[0].name}, 'warning')
    `;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete site error:', err);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// Delete all sites
app.delete('/api/sites', requireAuth, async (req, res) => {
  try {
    await sql`
      DELETE FROM sites WHERE clerk_user_id = ${req.userId}
    `;

    // Log audit entry
    await sql`
      INSERT INTO audit_log (clerk_user_id, type, message, severity)
      VALUES (${req.userId}, 'bulk_delete', 'All sites deleted', 'warning')
    `;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete all sites error:', err);
    res.status(500).json({ error: 'Failed to delete sites' });
  }
});

// ============ MONITORING ROUTES ============

// Get monitoring data for a site
app.get('/api/monitoring/:siteId', requireAuth, async (req, res) => {
  try {
    const { siteId } = req.params;

    // Verify site ownership
    const site = await sql`
      SELECT * FROM sites WHERE id = ${siteId} AND clerk_user_id = ${req.userId}
    `;

    if (site.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Get latest monitoring data
    const data = await sql`
      SELECT * FROM monitoring_data
      WHERE site_id = ${siteId}
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    res.json(data[0] || {});
  } catch (err) {
    console.error('Get monitoring error:', err);
    res.status(500).json({ error: 'Failed to fetch monitoring data' });
  }
});

// Get monitoring history
app.get('/api/monitoring/:siteId/history', requireAuth, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { hours = 24 } = req.query;

    // Verify site ownership
    const site = await sql`
      SELECT * FROM sites WHERE id = ${siteId} AND clerk_user_id = ${req.userId}
    `;

    if (site.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const data = await sql`
      SELECT * FROM monitoring_data
      WHERE site_id = ${siteId}
        AND timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    res.json(data);
  } catch (err) {
    console.error('Get monitoring history error:', err);
    res.status(500).json({ error: 'Failed to fetch monitoring history' });
  }
});

// Get SNMP data for a site
app.get('/api/monitoring/:siteId/snmp', requireAuth, async (req, res) => {
  try {
    const { siteId } = req.params;

    // Verify site ownership
    const site = await sql`
      SELECT * FROM sites WHERE id = ${siteId} AND clerk_user_id = ${req.userId}
    `;

    if (site.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const data = await sql`
      SELECT * FROM snmp_data
      WHERE site_id = ${siteId}
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    res.json(data[0] || {});
  } catch (err) {
    console.error('Get SNMP error:', err);
    res.status(500).json({ error: 'Failed to fetch SNMP data' });
  }
});

// Placeholder for NetFlow data
app.get('/api/monitoring/:siteId/netflow', requireAuth, async (req, res) => {
  res.json({ message: 'NetFlow monitoring coming soon' });
});

// Placeholder for Meraki data
app.get('/api/monitoring/:siteId/meraki', requireAuth, async (req, res) => {
  res.json({ message: 'Meraki API integration coming soon' });
});

// ============ PRESETS ROUTES ============

// Get all presets
app.get('/api/presets', requireAuth, async (req, res) => {
  try {
    const presets = await sql`
      SELECT * FROM presets
      WHERE clerk_user_id = ${req.userId}
      ORDER BY created_at DESC
    `;
    res.json(presets);
  } catch (err) {
    console.error('Get presets error:', err);
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});

// Create preset
app.post('/api/presets', requireAuth, async (req, res) => {
  try {
    const { name, description, sites } = req.body;

    const result = await sql`
      INSERT INTO presets (clerk_user_id, name, description, sites)
      VALUES (${req.userId}, ${name}, ${description || null}, ${JSON.stringify(sites)})
      RETURNING *
    `;

    res.json(result[0]);
  } catch (err) {
    console.error('Create preset error:', err);
    res.status(500).json({ error: 'Failed to create preset' });
  }
});

// Update preset
app.put('/api/presets/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sites } = req.body;

    const result = await sql`
      UPDATE presets SET
        name = ${name},
        description = ${description || null},
        sites = ${JSON.stringify(sites)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND clerk_user_id = ${req.userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json(result[0]);
  } catch (err) {
    console.error('Update preset error:', err);
    res.status(500).json({ error: 'Failed to update preset' });
  }
});

// Delete preset
app.delete('/api/presets/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await sql`
      DELETE FROM presets WHERE id = ${id} AND clerk_user_id = ${req.userId}
    `;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete preset error:', err);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// ============ AUDIT LOG ROUTES ============

// Get audit log
app.get('/api/audit', requireAuth, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const logs = await sql`
      SELECT * FROM audit_log
      WHERE clerk_user_id = ${req.userId}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    res.json(logs);
  } catch (err) {
    console.error('Get audit log error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Create audit entry
app.post('/api/audit', requireAuth, async (req, res) => {
  try {
    const { type, site_id, site_name, customer, message, severity } = req.body;

    const result = await sql`
      INSERT INTO audit_log (
        clerk_user_id, type, site_id, site_name, customer, message, severity
      ) VALUES (
        ${req.userId}, ${type}, ${site_id || null}, ${site_name || null},
        ${customer || null}, ${message}, ${severity || 'info'}
      )
      RETURNING *
    `;

    res.json(result[0]);
  } catch (err) {
    console.error('Create audit entry error:', err);
    res.status(500).json({ error: 'Failed to create audit entry' });
  }
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile('dist/index.html', { root: '.' });
  });
}

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});
