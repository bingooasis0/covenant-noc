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

// Get device statuses in a network
async function getNetworkDeviceStatuses(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/devices/statuses`, apiKey);
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
    // Note: The endpoint /networks/{networkId}/appliance/performance doesn't officially exist in standard docs
    // but is often used in examples. It might be deprecated or require specific firmware.
    // We'll try to fetch it, but return null on 404 to avoid breaking the whole flow.
    return await makeRequest(`/networks/${networkId}/appliance/performance`, apiKey);
  } catch (err) {
    console.warn('Error getting appliance performance (endpoint might be invalid for this network):', err.message);
    return null;
  }
}

// Get network clients
async function getNetworkClients(apiKey, networkId, timespan = 86400) {
  try {
    return await makeRequest(`/networks/${networkId}/clients?timespan=${timespan}`, apiKey);
  } catch (err) {
    console.error('Error getting network clients:', err.message);
    return [];
  }
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

// Get comprehensive device metrics (Robust)
async function getDeviceMetrics(apiKey, deviceIp) {
  try {
    // Find the device first
    const deviceInfo = await findDeviceByIp(apiKey, deviceIp);

    if (!deviceInfo) {
      throw new Error(`Device with IP ${deviceIp} not found`);
    }

    const { device, network, organization } = deviceInfo;

    // Safely fetch various metrics
    const [uplinks, performance, clients, traffic] = await Promise.all([
      getOrgUplinkStatuses(apiKey, organization.id).catch(e => { console.warn('Uplink status fetch failed', e.message); return []; }),
      getAppliancePerformance(apiKey, network.id).catch(e => null),
      getNetworkClients(apiKey, network.id, 7200).catch(e => { console.warn('Client fetch failed', e.message); return []; }),
      getNetworkTraffic(apiKey, network.id, 7200).catch(e => null)
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

// --- NEW EXPANDED API FUNCTIONS ---

// Get L3 Firewall Rules
async function getL3FirewallRules(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/l3FirewallRules`, apiKey);
}

// Update L3 Firewall Rules
async function updateL3FirewallRules(apiKey, networkId, rules) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/l3FirewallRules`, apiKey, 'PUT', { rules });
}

// Get Port Forwarding Rules
async function getPortForwardingRules(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/portForwardingRules`, apiKey);
}

// Update Port Forwarding Rules
async function updatePortForwardingRules(apiKey, networkId, rules) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/portForwardingRules`, apiKey, 'PUT', { rules });
}

// Get VLANs
async function getVlans(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/vlans`, apiKey);
}

// Create VLAN
async function createVlan(apiKey, networkId, vlanData) {
  return await makeRequest(`/networks/${networkId}/appliance/vlans`, apiKey, 'POST', vlanData);
}

// Update VLAN
async function updateVlan(apiKey, networkId, vlanId, vlanData) {
  return await makeRequest(`/networks/${networkId}/appliance/vlans/${vlanId}`, apiKey, 'PUT', vlanData);
}

// Delete VLAN
async function deleteVlan(apiKey, networkId, vlanId) {
  return await makeRequest(`/networks/${networkId}/appliance/vlans/${vlanId}`, apiKey, 'DELETE');
}

// Get Switch Ports
async function getSwitchPorts(apiKey, serial) {
  return await makeRequest(`/devices/${serial}/switch/ports`, apiKey);
}

// Update Switch Port
async function updateSwitchPort(apiKey, serial, portId, portData) {
  return await makeRequest(`/devices/${serial}/switch/ports/${portId}`, apiKey, 'PUT', portData);
}

// Get Wireless SSIDs
async function getWirelessSsids(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/wireless/ssids`, apiKey);
}

// Update Wireless SSID
async function updateWirelessSsid(apiKey, networkId, number, ssidData) {
  return await makeRequest(`/networks/${networkId}/wireless/ssids/${number}`, apiKey, 'PUT', ssidData);
}

// Get Content Filtering Settings
async function getContentFiltering(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/contentFiltering`, apiKey);
}

// Update Content Filtering Settings
async function updateContentFiltering(apiKey, networkId, settings) {
  return await makeRequest(`/networks/${networkId}/appliance/contentFiltering`, apiKey, 'PUT', settings);
}

// Get L7 Firewall Rules
async function getL7FirewallRules(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/l7FirewallRules`, apiKey);
}

// Update L7 Firewall Rules
async function updateL7FirewallRules(apiKey, networkId, rules) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/l7FirewallRules`, apiKey, 'PUT', { rules });
}

// Get One-to-One NAT Rules
async function getOneToOneNatRules(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/oneToOneNatRules`, apiKey);
}

// Update One-to-One NAT Rules
async function updateOneToOneNatRules(apiKey, networkId, rules) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/oneToOneNatRules`, apiKey, 'PUT', { rules });
}

// Get One-to-Many NAT Rules
async function getOneToManyNatRules(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/oneToManyNatRules`, apiKey);
}

// Update One-to-Many NAT Rules
async function updateOneToManyNatRules(apiKey, networkId, rules) {
  return await makeRequest(`/networks/${networkId}/appliance/firewall/oneToManyNatRules`, apiKey, 'PUT', { rules });
}

// Get Traffic Shaping Rules
async function getTrafficShapingRules(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/trafficShaping/rules`, apiKey);
}

// Update Traffic Shaping Rules
async function updateTrafficShapingRules(apiKey, networkId, rules) {
  return await makeRequest(`/networks/${networkId}/appliance/trafficShaping/rules`, apiKey, 'PUT', { rules });
}

// Get Network Settings
async function getNetworkSettings(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}`, apiKey);
}

// Update Network Settings
async function updateNetworkSettings(apiKey, networkId, settings) {
  return await makeRequest(`/networks/${networkId}`, apiKey, 'PUT', settings);
}

// Get Network Group Policies
async function getGroupPolicies(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/groupPolicies`, apiKey);
}

// Create Group Policy
async function createGroupPolicy(apiKey, networkId, policyData) {
  return await makeRequest(`/networks/${networkId}/groupPolicies`, apiKey, 'POST', policyData);
}

// Update Group Policy
async function updateGroupPolicy(apiKey, networkId, policyId, policyData) {
  return await makeRequest(`/networks/${networkId}/groupPolicies/${policyId}`, apiKey, 'PUT', policyData);
}

// Delete Group Policy
async function deleteGroupPolicy(apiKey, networkId, policyId) {
  return await makeRequest(`/networks/${networkId}/groupPolicies/${policyId}`, apiKey, 'DELETE');
}

// Get Network Clients (with details)
async function getNetworkClientsDetailed(apiKey, networkId, timespan = 86400, perPage = 100) {
  return await makeRequest(`/networks/${networkId}/clients?timespan=${timespan}&perPage=${perPage}`, apiKey);
}

// Get Client Details
async function getClientDetails(apiKey, networkId, clientId, timespan = 86400) {
  return await makeRequest(`/networks/${networkId}/clients/${clientId}?timespan=${timespan}`, apiKey);
}

// Get Network Events
async function getNetworkEvents(apiKey, networkId, productType = null, includedEventTypes = null, excludedEventTypes = null, deviceMac = null, deviceSerial = null, deviceName = null, clientIp = null, clientMac = null, clientName = null, smDeviceMac = null, smDeviceName = null, perPage = 1000, startingAfter = null, endingBefore = null) {
  let queryParams = `?perPage=${perPage}`;
  if (productType) queryParams += `&productType=${productType}`;
  if (includedEventTypes) queryParams += `&includedEventTypes[]=${Array.isArray(includedEventTypes) ? includedEventTypes.join('&includedEventTypes[]=') : includedEventTypes}`;
  if (excludedEventTypes) queryParams += `&excludedEventTypes[]=${Array.isArray(excludedEventTypes) ? excludedEventTypes.join('&excludedEventTypes[]=') : excludedEventTypes}`;
  if (deviceMac) queryParams += `&deviceMac=${deviceMac}`;
  if (deviceSerial) queryParams += `&deviceSerial=${deviceSerial}`;
  if (deviceName) queryParams += `&deviceName=${deviceName}`;
  if (clientIp) queryParams += `&clientIp=${clientIp}`;
  if (clientMac) queryParams += `&clientMac=${clientMac}`;
  if (clientName) queryParams += `&clientName=${clientName}`;
  if (smDeviceMac) queryParams += `&smDeviceMac=${smDeviceMac}`;
  if (smDeviceName) queryParams += `&smDeviceName=${smDeviceName}`;
  if (startingAfter) queryParams += `&startingAfter=${startingAfter}`;
  if (endingBefore) queryParams += `&endingBefore=${endingBefore}`;
  
  return await makeRequest(`/networks/${networkId}/events${queryParams}`, apiKey);
}

// Get Network Alerts Settings
async function getNetworkAlerts(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/alerts/settings`, apiKey);
}

// Update Network Alerts Settings
async function updateNetworkAlerts(apiKey, networkId, alertSettings) {
  return await makeRequest(`/networks/${networkId}/alerts/settings`, apiKey, 'PUT', alertSettings);
}

// Get Network Splash Page Settings
async function getSplashPageSettings(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/wireless/ssids/0/splash/settings`, apiKey);
}

// Update Splash Page Settings
async function updateSplashPageSettings(apiKey, networkId, ssidNumber, settings) {
  return await makeRequest(`/networks/${networkId}/wireless/ssids/${ssidNumber}/splash/settings`, apiKey, 'PUT', settings);
}

// Get Network Site-to-Site VPN Settings
async function getSiteToSiteVpn(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/vpn/siteToSiteVpn`, apiKey);
}

// Update Site-to-Site VPN Settings
async function updateSiteToSiteVpn(apiKey, networkId, vpnSettings) {
  return await makeRequest(`/networks/${networkId}/appliance/vpn/siteToSiteVpn`, apiKey, 'PUT', vpnSettings);
}

// Get Network Static Routes
async function getStaticRoutes(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/staticRoutes`, apiKey);
}

// Create Static Route
async function createStaticRoute(apiKey, networkId, routeData) {
  return await makeRequest(`/networks/${networkId}/appliance/staticRoutes`, apiKey, 'POST', routeData);
}

// Update Static Route
async function updateStaticRoute(apiKey, networkId, routeId, routeData) {
  return await makeRequest(`/networks/${networkId}/appliance/staticRoutes/${routeId}`, apiKey, 'PUT', routeData);
}

// Delete Static Route
async function deleteStaticRoute(apiKey, networkId, routeId) {
  return await makeRequest(`/networks/${networkId}/appliance/staticRoutes/${routeId}`, apiKey, 'DELETE');
}

// Get Network DHCP Settings
async function getDhcpSettings(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/dhcp`, apiKey);
}

// Update DHCP Settings
async function updateDhcpSettings(apiKey, networkId, dhcpSettings) {
  return await makeRequest(`/networks/${networkId}/appliance/dhcp`, apiKey, 'PUT', dhcpSettings);
}

// Get Network Warm Spare Settings
async function getWarmSpareSettings(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/appliance/warmSpare`, apiKey);
}

// Update Warm Spare Settings
async function updateWarmSpareSettings(apiKey, networkId, warmSpareSettings) {
  return await makeRequest(`/networks/${networkId}/appliance/warmSpare`, apiKey, 'PUT', warmSpareSettings);
}

// Get Network Switch Stacks
async function getSwitchStacks(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/switch/stacks`, apiKey);
}

// Get Switch Stack Details
async function getSwitchStack(apiKey, networkId, stackId) {
  return await makeRequest(`/networks/${networkId}/switch/stacks/${stackId}`, apiKey);
}

// Get Network Wireless RF Profiles
async function getWirelessRfProfiles(apiKey, networkId) {
  return await makeRequest(`/networks/${networkId}/wireless/rfProfiles`, apiKey);
}

// Get Network Wireless Signal Quality History
async function getWirelessSignalQuality(apiKey, networkId, timespan = 3600) {
  return await makeRequest(`/networks/${networkId}/wireless/signalQualityHistory?timespan=${timespan}`, apiKey);
}

// Get Network Connection Stats
async function getConnectionStats(apiKey, networkId, timespan = 3600) {
  return await makeRequest(`/networks/${networkId}/connectionStats?timespan=${timespan}`, apiKey);
}

// Get Network Latency Stats
async function getLatencyStats(apiKey, networkId, timespan = 3600) {
  return await makeRequest(`/networks/${networkId}/latencyStats?timespan=${timespan}`, apiKey);
}

// Get Network Failed Connections
async function getFailedConnections(apiKey, networkId, timespan = 3600) {
  return await makeRequest(`/networks/${networkId}/failedConnections?timespan=${timespan}`, apiKey);
}

module.exports = {
  getOrganizations,
  getNetworks,
  getNetworkDevices,
  getNetworkDeviceStatuses,
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
  cyclePort,
  // New Exported Functions
  getL3FirewallRules,
  updateL3FirewallRules,
  getPortForwardingRules,
  updatePortForwardingRules,
  getVlans,
  createVlan,
  updateVlan,
  deleteVlan,
  getSwitchPorts,
  updateSwitchPort,
  getWirelessSsids,
  updateWirelessSsid,
  // Content Filtering
  getContentFiltering,
  updateContentFiltering,
  // L7 Firewall
  getL7FirewallRules,
  updateL7FirewallRules,
  // NAT Rules
  getOneToOneNatRules,
  updateOneToOneNatRules,
  getOneToManyNatRules,
  updateOneToManyNatRules,
  // Traffic Shaping
  getTrafficShapingRules,
  updateTrafficShapingRules,
  // Network Settings
  getNetworkSettings,
  updateNetworkSettings,
  // Group Policies
  getGroupPolicies,
  createGroupPolicy,
  updateGroupPolicy,
  deleteGroupPolicy,
  // Clients
  getNetworkClientsDetailed,
  getClientDetails,
  // Events
  getNetworkEvents,
  // Alerts
  getNetworkAlerts,
  updateNetworkAlerts,
  // Splash Page
  getSplashPageSettings,
  updateSplashPageSettings,
  // VPN
  getSiteToSiteVpn,
  updateSiteToSiteVpn,
  // Static Routes
  getStaticRoutes,
  createStaticRoute,
  updateStaticRoute,
  deleteStaticRoute,
  // DHCP
  getDhcpSettings,
  updateDhcpSettings,
  // Warm Spare
  getWarmSpareSettings,
  updateWarmSpareSettings,
  // Switch Stacks
  getSwitchStacks,
  getSwitchStack,
  // Wireless
  getWirelessRfProfiles,
  getWirelessSignalQuality,
  // Stats
  getConnectionStats,
  getLatencyStats,
  getFailedConnections
};
