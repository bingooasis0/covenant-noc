const https = require('https');
const dns = require('dns').promises;

const BASE_URL = 'https://api.meraki.com/api/v1';

// Make API request to Meraki
async function makeRequest(endpoint, apiKey, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);

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

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Get organizations
async function getOrganizations(apiKey) {
  return await makeRequest('/organizations', apiKey);
}

// Get networks for an organization
async function getNetworks(apiKey, organizationId) {
  return await makeRequest(`/organizations/${organizationId}/networks`, apiKey);
}

// Get devices in a network
async function getNetworkDevices(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/devices`, apiKey);
}

// Get device details by serial
async function getDevice(apiKey, serial) {
  return await makeRequest(`/devices/${serial}`, apiKey);
}

// Get device uplink information
async function getDeviceUplinks(apiKey, serial) {
  try {
    return await makeRequest(`/devices/${serial}/uplinks/settings`, apiKey);
  } catch (err) {
    console.error('Error getting uplinks:', err.message);
    return null;
  }
}

// Get organization uplink statuses (for all devices)
async function getOrgUplinkStatuses(apiKey, organizationId) {
  return await makeRequest(`/organizations/${organizationId}/uplinks/statuses`, apiKey);
}

// Get appliance performance
async function getAppliancePerformance(apiKey, networkId) {
  try {
    return await makeRequest(`/networks/${networkId}/appliance/performance`, apiKey);
  } catch (err) {
    console.error('Error getting appliance performance:', err.message);
    return null;
  }
}

// Get network clients
async function getNetworkClients(apiKey, networkId, timespan = 86400) {
  return await makeRequest(`/networks/${networkId}/clients?timespan=${timespan}`, apiKey);
}

// Get network traffic
async function getNetworkTraffic(apiKey, networkId, timespan = 3600) {
  try {
    return await makeRequest(`/networks/${networkId}/traffic?timespan=${timespan}`, apiKey);
  } catch (err) {
    console.error('Error getting network traffic:', err.message);
    return null;
  }
}

// Resolve hostname to IP if needed
async function resolveHostname(host) {
  // Check if it's already an IP address
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return host; // Already an IP
  }

  try {
    const addresses = await dns.resolve4(host);
    console.log(`[DNS] Resolved ${host} to ${addresses[0]}`);
    return addresses[0]; // Return first IP
  } catch (err) {
    console.error(`[DNS] Failed to resolve ${host}:`, err.message);
    return host; // Return as-is if can't resolve
  }
}

// Find device by IP address (or DDNS hostname)
async function findDeviceByIp(apiKey, deviceIp) {
  try {
    // Resolve hostname to IP if needed
    const resolvedIp = await resolveHostname(deviceIp);

    // Get all organizations
    const orgs = await getOrganizations(apiKey);

    for (const org of orgs) {
      // Get all networks in organization
      const networks = await getNetworks(apiKey, org.id);

      for (const network of networks) {
        // Get all devices in network
        const devices = await getNetworkDevices(apiKey, network.id);

        // Find device with matching IP
        for (const device of devices) {
          // Check various IP fields
          if (device.lanIp === resolvedIp ||
              device.wan1Ip === resolvedIp ||
              device.wan2Ip === resolvedIp ||
              device.publicIp === resolvedIp) {
            return {
              device,
              network,
              organization: org
            };
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error('Error finding device by IP:', err.message);
    return null;
  }
}

// Get comprehensive device metrics
async function getDeviceMetrics(apiKey, deviceIp) {
  try {
    // Find the device first
    const deviceInfo = await findDeviceByIp(apiKey, deviceIp);

    if (!deviceInfo) {
      throw new Error(`Device with IP ${deviceIp} not found`);
    }

    const { device, network, organization } = deviceInfo;

    // Get various metrics (Meraki requires minimum 2 hours for traffic)
    const [uplinks, performance, clients, traffic] = await Promise.all([
      getOrgUplinkStatuses(apiKey, organization.id),
      getAppliancePerformance(apiKey, network.id),
      getNetworkClients(apiKey, network.id, 7200), // Last 2 hours (minimum)
      getNetworkTraffic(apiKey, network.id, 7200) // Last 2 hours (minimum)
    ]);

    // Find uplink status for this device
    const deviceUplinks = uplinks?.find(u => u.serial === device.serial);

    return {
      device: {
        serial: device.serial,
        model: device.model,
        name: device.name,
        mac: device.mac,
        lanIp: device.lanIp,
        publicIp: device.publicIp,
        status: device.status,
        productType: device.productType
      },
      network: {
        id: network.id,
        name: network.name,
        timeZone: network.timeZone
      },
      uplinks: deviceUplinks?.uplinks || [],
      performance: performance || {},
      activeClients: clients?.length || 0,
      traffic: traffic || {},
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error getting device metrics:', err.message);
    throw err;
  }
}

// Ping test (Live Tool)
async function pingTest(apiKey, serial, target) {
  try {
    const response = await makeRequest(`/devices/${serial}/liveTools/ping`, apiKey);
    return response;
  } catch (err) {
    console.error('Error running ping test:', err.message);
    return null;
  }
}

// Reboot device
async function rebootDevice(apiKey, serial) {
  try {
    const response = await makeRequest(`/devices/${serial}/reboot`, apiKey, 'POST');
    return response;
  } catch (err) {
    console.error('Error rebooting device:', err.message);
    throw err;
  }
}

// Blink device LEDs
async function blinkDeviceLeds(apiKey, serial, duration = 20) {
  try {
    const response = await makeRequest(`/devices/${serial}/blinkLeds`, apiKey, 'POST', { duration });
    return response;
  } catch (err) {
    console.error('Error blinking LEDs:', err.message);
    throw err;
  }
}

// Cycle port on switch
async function cyclePort(apiKey, serial, portId) {
  try {
    const response = await makeRequest(`/devices/${serial}/switch/ports/${portId}/cycle`, apiKey, 'POST');
    return response;
  } catch (err) {
    console.error('Error cycling port:', err.message);
    throw err;
  }
}

module.exports = {
  getOrganizations,
  getNetworks,
  getNetworkDevices,
  getDevice,
  getDeviceUplinks,
  getOrgUplinkStatuses,
  getAppliancePerformance,
  getNetworkClients,
  getNetworkTraffic,
  findDeviceByIp,
  getDeviceMetrics,
  pingTest,
  rebootDevice,
  blinkDeviceLeds,
  cyclePort
};
