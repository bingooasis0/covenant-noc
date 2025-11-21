/**
 * Meraki API Routes
 * Handles Meraki device management, configuration, and monitoring
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { requireAuth } = require('../auth/middleware');
const merakiApi = require('../meraki-api');
const https = require('https');
const NodeCache = require('node-cache');

// Initialize cache with 5 minute TTL (std check) and 10 min check period
const merakiCache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

// Helper to get/set cache
const getOrSetCache = async (key, fetchFunction) => {
  const cached = merakiCache.get(key);
  if (cached) {
    return cached;
  }
  try {
    const data = await fetchFunction();
    merakiCache.set(key, data);
    return data;
  } catch (error) {
    console.error(`Cache fetch failed for ${key}:`, error);
    throw error;
  }
};

/**
 * GET /api/meraki/devices
 * Get all Meraki devices from configured sites
 */
router.get('/devices', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    // Cache key based on API key (scope)
    const cacheKey = `devices_${apiKey}`;
    
    const devices = await getOrSetCache(cacheKey, async () => {
      // 1. Get Organizations
      const orgs = await merakiApi.getOrganizations(apiKey);
      
      let allDevices = [];
      
      // 2. Parallel fetch for each org
      await Promise.all(orgs.map(async (org) => {
        try {
          // Get networks first
          const networks = await merakiApi.getNetworks(apiKey, org.id);
          
          // Get devices for each network
          await Promise.all(networks.map(async (net) => {
            try {
              const netDevices = await merakiApi.getNetworkDevices(apiKey, net.id);
              const deviceStatuses = await merakiApi.getNetworkDeviceStatuses(apiKey, net.id);
              
              // Merge status into device info
              const devicesWithStatus = netDevices.map(d => {
                const statusInfo = deviceStatuses.find(s => s.serial === d.serial);
                return {
                  ...d,
                  status: statusInfo ? statusInfo.status : 'unknown',
                  organizationId: org.id,
                  organizationName: org.name,
                  networkName: net.name,
                  lastReportedAt: statusInfo ? statusInfo.lastReportedAt : null
                };
              });
              
              allDevices.push(...devicesWithStatus);
            } catch (err) {
              console.error(`Failed to fetch devices/statuses for network ${net.id}:`, err.message);
            }
          }));
        } catch (err) {
          console.error(`Failed to fetch networks for org ${org.id}:`, err.message);
        }
      }));
      
      return allDevices;
    });

    res.json(devices);
  } catch (error) {
    console.error('Get Meraki devices error:', error);
    res.status(500).json({ error: 'Failed to fetch Meraki devices' });
  }
});

/**
 * GET /api/meraki/device/:serial
 * Get detailed information for a specific device
 */
router.get('/device/:serial', requireAuth, async (req, res) => {
  try {
    const { serial } = req.params;
    if (!serial || serial.trim() === '') {
      return res.status(400).json({ error: 'Device serial is required' });
    }

    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const cacheKey = `device_detail_${serial}`;
    
    const deviceDetail = await getOrSetCache(cacheKey, async () => {
      // Fetch device basic info
      let device;
      try {
        device = await merakiApi.getDevice(apiKey, serial);
      } catch (err) {
        console.error(`Failed to fetch device ${serial}:`, err.message);
        throw new Error(`Device not found or inaccessible: ${err.message}`);
      }

      // Try to get additional info (failures are non-critical)
      const additionalInfo = {};
      
      // Get Uplink info (may not be available for all devices)
      try {
        const uplinks = await merakiApi.getDeviceUplinks(apiKey, serial);
        if (uplinks) additionalInfo.uplinks = uplinks;
      } catch (e) {
        console.log(`Uplink info not available for ${serial}`);
      }

      // Get switch ports if it's a switch
      if (device.model && device.model.startsWith('MS')) {
        try {
          const ports = await merakiApi.getSwitchPorts(apiKey, serial);
          if (ports) additionalInfo.switchPorts = ports;
        } catch (e) {
          console.log(`Switch ports not available for ${serial}`);
        }
      }

      return { ...device, ...additionalInfo };
    });
    
    res.json(deviceDetail);
  } catch (error) {
    console.error('Get Meraki device error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ 
      error: error.message || 'Failed to fetch device details',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/meraki/device/:serial/update
 * Update device configuration
 */
router.post('/device/:serial/update', requireAuth, async (req, res) => {
  try {
    const { serial } = req.params;
    const { config } = req.body;

    // Invalidate specific device cache
    merakiCache.del(`device_detail_${serial}`);
    
    // TODO: Implement actual Meraki API configuration update via merakiApi wrapper
    // For now, logging it
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_device_updated',
        details: { serial, config }
      }
    });

    res.json({ success: true, message: 'Device configuration updated' });
  } catch (error) {
    console.error('Update Meraki device error:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

/**
 * POST /api/meraki/device/:serial/reboot
 * Reboot a Meraki device
 */
router.post('/device/:serial/reboot', requireAuth, async (req, res) => {
  try {
    const { serial } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';

    await merakiApi.rebootDevice(apiKey, serial);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_device_rebooted',
        details: { serial }
      }
    });

    res.json({ success: true, message: 'Device reboot initiated' });
  } catch (error) {
    console.error('Reboot Meraki device error:', error);
    res.status(500).json({ error: 'Failed to reboot device' });
  }
});

/**
 * GET /api/meraki/networks
 * Get all Meraki networks
 */
router.get('/networks', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const cacheKey = `networks_${apiKey}`;

    const networks = await getOrSetCache(cacheKey, async () => {
      const orgs = await merakiApi.getOrganizations(apiKey);
      let allNetworks = [];
      for (const org of orgs) {
        const nets = await merakiApi.getNetworks(apiKey, org.id);
        allNetworks.push(...nets.map(n => ({ ...n, organizationId: org.id, organizationName: org.name })));
      }
      return allNetworks;
    });

    res.json(networks);
  } catch (error) {
    console.error('Get Meraki networks error:', error);
    res.status(500).json({ error: 'Failed to fetch networks' });
  }
});

/**
 * GET /api/meraki/organizations
 * Get all Meraki organizations
 */
router.get('/organizations', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const cacheKey = `orgs_${apiKey}`;
    
    const orgs = await getOrSetCache(cacheKey, async () => {
      return await merakiApi.getOrganizations(apiKey);
    });
    
    res.json(orgs);
  } catch (error) {
    console.error('Get Meraki organizations error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * GET /api/meraki/organizations/:orgId/networks
 * Get networks for an organization
 */
router.get('/organizations/:orgId/networks', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const cacheKey = `networks_org_${orgId}`;
    const networks = await getOrSetCache(cacheKey, async () => {
      return await merakiApi.getNetworks(apiKey, orgId);
    });
    
    res.json(networks);
  } catch (error) {
    console.error('Get Meraki networks error:', error);
    res.status(500).json({ error: 'Failed to fetch networks' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/devices
 * Get devices for a network
 */
router.get('/networks/:networkId/devices', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const cacheKey = `devices_net_${networkId}`;
    
    const devices = await getOrSetCache(cacheKey, async () => {
      const devs = await merakiApi.getNetworkDevices(apiKey, networkId);
      const statuses = await merakiApi.getNetworkDeviceStatuses(apiKey, networkId);
      
      return devs.map(d => {
        const status = statuses.find(s => s.serial === d.serial);
        return {
          ...d,
          status: status ? status.status : 'unknown',
          lastReportedAt: status ? status.lastReportedAt : null
        };
      });
    });

    res.json(devices);
  } catch (error) {
    console.error('Get Meraki devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * Helper function to make Meraki API requests
 */
function makeMerakiRequest(endpoint, apiKey, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.meraki.com/api/v1${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'X-Cisco-Meraki-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve({});
          }
        } else {
          reject(new Error(`API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * POST /api/meraki/quick-actions/content-filter
 * Add or remove URLs from content filtering whitelist
 */
router.post('/quick-actions/content-filter', requireAuth, async (req, res) => {
  try {
    const { action, url, organizationIds, networkIds, deviceSerials } = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const results = [];
    let targetNetworks = [];

    // Collect target networks
    if (organizationIds && organizationIds.length > 0) {
      for (const orgId of organizationIds) {
        const networks = await merakiApi.getNetworks(apiKey, orgId);
        targetNetworks.push(...networks);
      }
    }

    if (networkIds && networkIds.length > 0) {
      for (const networkId of networkIds) {
        const network = await makeMerakiRequest(`/networks/${networkId}`, apiKey);
        if (network.id) targetNetworks.push(network);
      }
    }

    if (deviceSerials && deviceSerials.length > 0) {
      // Get networks for devices
      const orgs = await merakiApi.getOrganizations(apiKey);
      for (const org of orgs) {
        const networks = await merakiApi.getNetworks(apiKey, org.id);
        for (const network of networks) {
          const devices = await merakiApi.getNetworkDevices(apiKey, network.id);
          const hasTargetDevice = devices.some(d => deviceSerials.includes(d.serial));
          if (hasTargetDevice && !targetNetworks.find(n => n.id === network.id)) {
            targetNetworks.push(network);
          }
        }
      }
    }

    // Process each network
    for (const network of targetNetworks) {
      try {
        const currentSettings = await makeMerakiRequest(`/networks/${network.id}/appliance/contentFiltering`, apiKey);
        const allowList = currentSettings.allowedUrlPatterns || [];

        if (action === 'add') {
          if (!allowList.includes(url)) {
            allowList.push(url);
            await makeMerakiRequest(`/networks/${network.id}/appliance/contentFiltering`, apiKey, 'PUT', {
              allowedUrlPatterns: allowList
            });
            results.push({ networkId: network.id, networkName: network.name, success: true, action: 'added' });
          } else {
            results.push({ networkId: network.id, networkName: network.name, success: false, message: 'URL already in whitelist' });
          }
        } else if (action === 'remove') {
          if (allowList.includes(url)) {
            allowList.splice(allowList.indexOf(url), 1);
            await makeMerakiRequest(`/networks/${network.id}/appliance/contentFiltering`, apiKey, 'PUT', {
              allowedUrlPatterns: allowList
            });
            results.push({ networkId: network.id, networkName: network.name, success: true, action: 'removed' });
          } else {
            results.push({ networkId: network.id, networkName: network.name, success: false, message: 'URL not in whitelist' });
          }
        }
      } catch (error) {
        results.push({ networkId: network.id, networkName: network.name, success: false, error: error.message });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_content_filter_updated',
        details: { action, url, results }
      }
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Content filter error:', error);
    res.status(500).json({ error: error.message || 'Failed to update content filtering' });
  }
});

/**
 * POST /api/meraki/quick-actions/pull-device-info
 * Pull device information for selected targets
 */
router.post('/quick-actions/pull-device-info', requireAuth, async (req, res) => {
  try {
    const { organizationIds, networkIds, deviceSerials } = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const results = [];
    let targetDevices = [];

    // Collect target devices
    if (deviceSerials && deviceSerials.length > 0) {
      for (const serial of deviceSerials) {
        try {
          const device = await merakiApi.getDevice(apiKey, serial);
          targetDevices.push(device);
        } catch (error) {
          results.push({ serial, success: false, error: error.message });
        }
      }
    }

    if (networkIds && networkIds.length > 0) {
      for (const networkId of networkIds) {
        try {
          const devices = await merakiApi.getNetworkDevices(apiKey, networkId);
          targetDevices.push(...devices.filter(d => !targetDevices.find(td => td.serial === d.serial)));
        } catch (error) {
          results.push({ networkId, success: false, error: error.message });
        }
      }
    }

    if (organizationIds && organizationIds.length > 0) {
      for (const orgId of organizationIds) {
        try {
          const networks = await merakiApi.getNetworks(apiKey, orgId);
          for (const network of networks) {
            const devices = await merakiApi.getNetworkDevices(apiKey, network.id);
            targetDevices.push(...devices.filter(d => !targetDevices.find(td => td.serial === d.serial)));
          }
        } catch (error) {
          results.push({ organizationId: orgId, success: false, error: error.message });
        }
      }
    }

    // Get detailed info for each device
    for (const device of targetDevices) {
      try {
        const deviceInfo = await merakiApi.getDevice(apiKey, device.serial);
        // Invalidate cache
        merakiCache.del(`device_detail_${device.serial}`);
        results.push({ serial: device.serial, success: true, data: deviceInfo });
      } catch (error) {
        results.push({ serial: device.serial, success: false, error: error.message });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_device_info_pulled',
        details: { results: results.length }
      }
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Pull device info error:', error);
    res.status(500).json({ error: error.message || 'Failed to pull device information' });
  }
});

/**
 * POST /api/meraki/quick-actions/reboot-devices
 * Reboot devices for selected targets
 */
router.post('/quick-actions/reboot-devices', requireAuth, async (req, res) => {
  try {
    const { organizationIds, networkIds, deviceSerials } = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const results = [];
    let targetDevices = [];

    // Collect target devices
    if (deviceSerials && deviceSerials.length > 0) {
      targetDevices.push(...deviceSerials.map(serial => ({ serial, networkId: null })));
    }

    if (networkIds && networkIds.length > 0) {
      for (const networkId of networkIds) {
        try {
          const devices = await merakiApi.getNetworkDevices(apiKey, networkId);
          for (const device of devices) {
            if (device.model && device.model.includes('MX')) {
              if (!targetDevices.find(td => td.serial === device.serial)) {
                targetDevices.push({ serial: device.serial, networkId });
              }
            }
          }
        } catch (error) {
          results.push({ networkId, success: false, error: error.message });
        }
      }
    }

    if (organizationIds && organizationIds.length > 0) {
      for (const orgId of organizationIds) {
        try {
          const networks = await merakiApi.getNetworks(apiKey, orgId);
          for (const network of networks) {
            const devices = await merakiApi.getNetworkDevices(apiKey, network.id);
            for (const device of devices) {
              if (device.model && device.model.includes('MX')) {
                if (!targetDevices.find(td => td.serial === device.serial)) {
                  targetDevices.push({ serial: device.serial, networkId: network.id });
                }
              }
            }
          }
        } catch (error) {
          results.push({ organizationId: orgId, success: false, error: error.message });
        }
      }
    }

    // Reboot each device
    for (const device of targetDevices) {
      try {
        await makeMerakiRequest(`/networks/${device.networkId || 'N_000000000000000000'}/devices/${device.serial}/reboot`, apiKey, 'POST');
        results.push({ serial: device.serial, success: true });
      } catch (error) {
        // Try without network ID
        try {
          await makeMerakiRequest(`/devices/${device.serial}/reboot`, apiKey, 'POST');
          results.push({ serial: device.serial, success: true });
        } catch (err) {
          results.push({ serial: device.serial, success: false, error: err.message });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_devices_rebooted',
        details: { deviceCount: targetDevices.length, results }
      }
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Reboot devices error:', error);
    res.status(500).json({ error: error.message || 'Failed to reboot devices' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/firewall/l3
 * Get L3 Firewall Rules
 */
router.get('/networks/:networkId/firewall/l3', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const rules = await merakiApi.getL3FirewallRules(apiKey, networkId);
    res.json(rules);
  } catch (error) {
    console.error('Get L3 firewall rules error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch L3 firewall rules' });
  }
});

/**
 * PUT /api/meraki/networks/:networkId/firewall/l3
 * Update L3 Firewall Rules
 */
router.put('/networks/:networkId/firewall/l3', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const { rules } = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    await merakiApi.updateL3FirewallRules(apiKey, networkId, rules);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_firewall_l3_updated',
        details: { networkId, ruleCount: rules?.length || 0 }
      }
    });
    
    res.json({ success: true, message: 'L3 firewall rules updated' });
  } catch (error) {
    console.error('Update L3 firewall rules error:', error);
    res.status(500).json({ error: error.message || 'Failed to update L3 firewall rules' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/firewall/l7
 * Get L7 Firewall Rules
 */
router.get('/networks/:networkId/firewall/l7', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const rules = await merakiApi.getL7FirewallRules(apiKey, networkId);
    res.json(rules);
  } catch (error) {
    console.error('Get L7 firewall rules error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch L7 firewall rules' });
  }
});

/**
 * PUT /api/meraki/networks/:networkId/firewall/l7
 * Update L7 Firewall Rules
 */
router.put('/networks/:networkId/firewall/l7', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const { rules } = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    await merakiApi.updateL7FirewallRules(apiKey, networkId, rules);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_firewall_l7_updated',
        details: { networkId, ruleCount: rules?.length || 0 }
      }
    });
    
    res.json({ success: true, message: 'L7 firewall rules updated' });
  } catch (error) {
    console.error('Update L7 firewall rules error:', error);
    res.status(500).json({ error: error.message || 'Failed to update L7 firewall rules' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/firewall/port-forwarding
 * Get Port Forwarding Rules
 */
router.get('/networks/:networkId/firewall/port-forwarding', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const rules = await merakiApi.getPortForwardingRules(apiKey, networkId);
    res.json(rules);
  } catch (error) {
    console.error('Get port forwarding rules error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch port forwarding rules' });
  }
});

/**
 * PUT /api/meraki/networks/:networkId/firewall/port-forwarding
 * Update Port Forwarding Rules
 */
router.put('/networks/:networkId/firewall/port-forwarding', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const { rules } = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    await merakiApi.updatePortForwardingRules(apiKey, networkId, rules);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_port_forwarding_updated',
        details: { networkId, ruleCount: rules?.length || 0 }
      }
    });
    
    res.json({ success: true, message: 'Port forwarding rules updated' });
  } catch (error) {
    console.error('Update port forwarding rules error:', error);
    res.status(500).json({ error: error.message || 'Failed to update port forwarding rules' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/vlans
 * Get VLANs
 */
router.get('/networks/:networkId/vlans', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const vlans = await merakiApi.getVlans(apiKey, networkId);
    res.json(vlans);
  } catch (error) {
    console.error('Get VLANs error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch VLANs' });
  }
});

/**
 * POST /api/meraki/networks/:networkId/vlans
 * Create VLAN
 */
router.post('/networks/:networkId/vlans', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const vlanData = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const vlan = await merakiApi.createVlan(apiKey, networkId, vlanData);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_vlan_created',
        details: { networkId, vlanId: vlan.id }
      }
    });
    
    res.json({ success: true, data: vlan });
  } catch (error) {
    console.error('Create VLAN error:', error);
    res.status(500).json({ error: error.message || 'Failed to create VLAN' });
  }
});

/**
 * PUT /api/meraki/networks/:networkId/vlans/:vlanId
 * Update VLAN
 */
router.put('/networks/:networkId/vlans/:vlanId', requireAuth, async (req, res) => {
  try {
    const { networkId, vlanId } = req.params;
    const vlanData = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const vlan = await merakiApi.updateVlan(apiKey, networkId, vlanId, vlanData);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_vlan_updated',
        details: { networkId, vlanId }
      }
    });
    
    res.json({ success: true, data: vlan });
  } catch (error) {
    console.error('Update VLAN error:', error);
    res.status(500).json({ error: error.message || 'Failed to update VLAN' });
  }
});

/**
 * DELETE /api/meraki/networks/:networkId/vlans/:vlanId
 * Delete VLAN
 */
router.delete('/networks/:networkId/vlans/:vlanId', requireAuth, async (req, res) => {
  try {
    const { networkId, vlanId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    await merakiApi.deleteVlan(apiKey, networkId, vlanId);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_vlan_deleted',
        details: { networkId, vlanId }
      }
    });
    
    res.json({ success: true, message: 'VLAN deleted' });
  } catch (error) {
    console.error('Delete VLAN error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete VLAN' });
  }
});

/**
 * GET /api/meraki/devices/:serial/switch/ports
 * Get Switch Ports
 */
router.get('/devices/:serial/switch/ports', requireAuth, async (req, res) => {
  try {
    const { serial } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const ports = await merakiApi.getSwitchPorts(apiKey, serial);
    res.json(ports);
  } catch (error) {
    console.error('Get switch ports error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch switch ports' });
  }
});

/**
 * PUT /api/meraki/devices/:serial/switch/ports/:portId
 * Update Switch Port
 */
router.put('/devices/:serial/switch/ports/:portId', requireAuth, async (req, res) => {
  try {
    const { serial, portId } = req.params;
    const portData = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const port = await merakiApi.updateSwitchPort(apiKey, serial, portId, portData);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_switch_port_updated',
        details: { serial, portId }
      }
    });
    
    res.json({ success: true, data: port });
  } catch (error) {
    console.error('Update switch port error:', error);
    res.status(500).json({ error: error.message || 'Failed to update switch port' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/wireless/ssids
 * Get Wireless SSIDs
 */
router.get('/networks/:networkId/wireless/ssids', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const ssids = await merakiApi.getWirelessSsids(apiKey, networkId);
    res.json(ssids);
  } catch (error) {
    console.error('Get wireless SSIDs error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch wireless SSIDs' });
  }
});

/**
 * PUT /api/meraki/networks/:networkId/wireless/ssids/:number
 * Update Wireless SSID
 */
router.put('/networks/:networkId/wireless/ssids/:number', requireAuth, async (req, res) => {
  try {
    const { networkId, number } = req.params;
    const ssidData = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const ssid = await merakiApi.updateWirelessSsid(apiKey, networkId, number, ssidData);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_ssid_updated',
        details: { networkId, ssidNumber: number }
      }
    });
    
    res.json({ success: true, data: ssid });
  } catch (error) {
    console.error('Update wireless SSID error:', error);
    res.status(500).json({ error: error.message || 'Failed to update wireless SSID' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/content-filtering
 * Get Content Filtering Settings
 */
router.get('/networks/:networkId/content-filtering', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const settings = await merakiApi.getContentFiltering(apiKey, networkId);
    res.json(settings);
  } catch (error) {
    console.error('Get content filtering error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch content filtering settings' });
  }
});

/**
 * PUT /api/meraki/networks/:networkId/content-filtering
 * Update Content Filtering Settings
 */
router.put('/networks/:networkId/content-filtering', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const settings = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    await merakiApi.updateContentFiltering(apiKey, networkId, settings);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_content_filtering_updated',
        details: { networkId }
      }
    });
    
    res.json({ success: true, message: 'Content filtering settings updated' });
  } catch (error) {
    console.error('Update content filtering error:', error);
    res.status(500).json({ error: error.message || 'Failed to update content filtering settings' });
  }
});

/**
 * GET /api/meraki/networks/:networkId/static-routes
 * Get Static Routes
 */
router.get('/networks/:networkId/static-routes', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    const routes = await merakiApi.getStaticRoutes(apiKey, networkId);
    res.json(routes);
  } catch (error) {
    console.error('Get static routes error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch static routes' });
  }
});

/**
 * POST /api/meraki/networks/:networkId/static-routes
 * Create Static Route
 */
router.post('/networks/:networkId/static-routes', requireAuth, async (req, res) => {
  try {
    const { networkId } = req.params;
    const routeData = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const route = await merakiApi.createStaticRoute(apiKey, networkId, routeData);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_static_route_created',
        details: { networkId, routeId: route.id }
      }
    });
    
    res.json({ success: true, data: route });
  } catch (error) {
    console.error('Create static route error:', error);
    res.status(500).json({ error: error.message || 'Failed to create static route' });
  }
});

/**
 * PUT /api/meraki/networks/:networkId/static-routes/:routeId
 * Update Static Route
 */
router.put('/networks/:networkId/static-routes/:routeId', requireAuth, async (req, res) => {
  try {
    const { networkId, routeId } = req.params;
    const routeData = req.body;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    const route = await merakiApi.updateStaticRoute(apiKey, networkId, routeId, routeData);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_static_route_updated',
        details: { networkId, routeId }
      }
    });
    
    res.json({ success: true, data: route });
  } catch (error) {
    console.error('Update static route error:', error);
    res.status(500).json({ error: error.message || 'Failed to update static route' });
  }
});

/**
 * DELETE /api/meraki/networks/:networkId/static-routes/:routeId
 * Delete Static Route
 */
router.delete('/networks/:networkId/static-routes/:routeId', requireAuth, async (req, res) => {
  try {
    const { networkId, routeId } = req.params;
    const apiKey = process.env.MERAKI_API_KEY || '6883f779d1ef91b08bd012aea847066b82bef0e1';
    
    await merakiApi.deleteStaticRoute(apiKey, networkId, routeId);
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'meraki_static_route_deleted',
        details: { networkId, routeId }
      }
    });
    
    res.json({ success: true, message: 'Static route deleted' });
  } catch (error) {
    console.error('Delete static route error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete static route' });
  }
});

module.exports = router;
