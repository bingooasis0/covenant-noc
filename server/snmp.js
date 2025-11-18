const snmp = require('net-snmp');

// OIDs for common metrics
const OIDS = {
  // System (SNMPv2-MIB - supported by Meraki)
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysName: '1.3.6.1.2.1.1.5.0',

  // CPU (hrProcessorLoad - NOT supported by Meraki)
  cpuLoad: '1.3.6.1.2.1.25.3.3.1.2',

  // Memory (NOT supported by Meraki)
  memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
  memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
  memBuffer: '1.3.6.1.4.1.2021.4.14.0',
  memCached: '1.3.6.1.4.1.2021.4.15.0',

  // Interface stats (IF-MIB - SUPPORTED by Meraki)
  ifNumber: '1.3.6.1.2.1.2.1.0',              // Number of interfaces
  ifDescr: '1.3.6.1.2.1.2.2.1.2',             // Interface description
  ifType: '1.3.6.1.2.1.2.2.1.3',              // Interface type
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',             // Interface speed
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',       // MAC address
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',       // Admin status
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',        // Operational status (up/down)
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',         // Bytes in
  ifInUcastPkts: '1.3.6.1.2.1.2.2.1.11',      // Unicast packets in
  ifInErrors: '1.3.6.1.2.1.2.2.1.14',         // Input errors
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',        // Bytes out
  ifOutUcastPkts: '1.3.6.1.2.1.2.2.1.17',     // Unicast packets out
  ifOutErrors: '1.3.6.1.2.1.2.2.1.20',        // Output errors
};

// Create SNMP session
function createSession(host, community = 'public', version = snmp.Version2c) {
  const options = {
    port: 161,
    retries: 1,
    timeout: 5000,
    version: version
  };

  console.log(`[SNMP] Creating session: host=${host}, community=${community}, port=161, timeout=5000ms`);
  return snmp.createSession(host, community, options);
}

// Get single OID value
function getSingleOid(session, oid) {
  return new Promise((resolve, reject) => {
    session.get([oid], (error, varbinds) => {
      if (error) {
        reject(error);
      } else {
        if (snmp.isVarbindError(varbinds[0])) {
          reject(new Error(snmp.varbindError(varbinds[0])));
        } else {
          resolve(varbinds[0].value);
        }
      }
    });
  });
}

// Get multiple OID values
function getMultipleOids(session, oids) {
  return new Promise((resolve, reject) => {
    session.get(oids, (error, varbinds) => {
      if (error) {
        reject(error);
      } else {
        const results = {};
        varbinds.forEach((vb, index) => {
          if (!snmp.isVarbindError(vb)) {
            results[oids[index]] = vb.value;
          }
        });
        resolve(results);
      }
    });
  });
}

// Walk OID tree (for interfaces)
function walkOid(session, oid) {
  return new Promise((resolve, reject) => {
    const results = [];

    session.walk(oid, 20, (varbinds) => {
      varbinds.forEach(vb => {
        if (!snmp.isVarbindError(vb)) {
          results.push({
            oid: vb.oid,
            value: vb.value
          });
        }
      });
    }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

// Get CPU usage
async function getCpuUsage(session) {
  try {
    const cpuLoads = await walkOid(session, OIDS.cpuLoad);
    if (cpuLoads.length === 0) return null;

    // Average all CPU cores
    const total = cpuLoads.reduce((sum, cpu) => sum + parseInt(cpu.value), 0);
    return Math.round(total / cpuLoads.length);
  } catch (err) {
    // Suppress NoSuchObject errors (common on Meraki devices that don't support CPU OIDs)
    if (!err.message.includes('NoSuchObject') && !err.message.includes('Request timed out')) {
      console.error('SNMP CPU error:', err.message);
    }
    return null;
  }
}

// Get memory usage
async function getMemoryUsage(session) {
  try {
    const memData = await getMultipleOids(session, [
      OIDS.memTotalReal,
      OIDS.memAvailReal
    ]);

    const total = parseInt(memData[OIDS.memTotalReal]) || 0;
    const available = parseInt(memData[OIDS.memAvailReal]) || 0;
    const used = total - available;
    const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;

    return {
      total: Math.round(total / 1024), // Convert to MB
      used: Math.round(used / 1024),   // Convert to MB
      available: Math.round(available / 1024),
      usedPercent
    };
  } catch (err) {
    // Suppress NoSuchObject errors (common on Meraki devices that don't support Memory OIDs)
    if (!err.message.includes('NoSuchObject') && !err.message.includes('Request timed out')) {
      console.error('SNMP Memory error:', err.message);
    }
    return null;
  }
}

// Get interface statistics (Full Meraki-supported data)
async function getInterfaceStats(session) {
  try {
    console.log('[SNMP] Walking interface OIDs...');
    const [descriptions, types, speeds, macAddrs, adminStatuses, operStatuses,
           inOctets, inPackets, inErrors, outOctets, outPackets, outErrors] = await Promise.all([
      walkOid(session, OIDS.ifDescr),
      walkOid(session, OIDS.ifType),
      walkOid(session, OIDS.ifSpeed),
      walkOid(session, OIDS.ifPhysAddress),
      walkOid(session, OIDS.ifAdminStatus),
      walkOid(session, OIDS.ifOperStatus),
      walkOid(session, OIDS.ifInOctets),
      walkOid(session, OIDS.ifInUcastPkts),
      walkOid(session, OIDS.ifInErrors),
      walkOid(session, OIDS.ifOutOctets),
      walkOid(session, OIDS.ifOutUcastPkts),
      walkOid(session, OIDS.ifOutErrors)
    ]);
    console.log(`[SNMP] Successfully walked interface OIDs, found ${descriptions.length} interfaces`);

    const interfaces = [];
    descriptions.forEach((desc, index) => {
      // Convert MAC address from buffer to string
      const macBuffer = macAddrs[index]?.value;
      let macAddress = 'N/A';
      if (macBuffer && Buffer.isBuffer(macBuffer)) {
        macAddress = Array.from(macBuffer)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(':')
          .toUpperCase();
      }

      const ifIndex = index + 1;
      interfaces.push({
        index: ifIndex,
        name: desc.value.toString(),
        type: parseInt(types[index]?.value || 0),
        speed: parseInt(speeds[index]?.value || 0),
        macAddress: macAddress,
        adminStatus: parseInt(adminStatuses[index]?.value || 2),
        operStatus: parseInt(operStatuses[index]?.value || 2),
        status: parseInt(operStatuses[index]?.value || 2) === 1 ? 'up' : 'down',
        inOctets: parseInt(inOctets[index]?.value || 0),
        inPackets: parseInt(inPackets[index]?.value || 0),
        inErrors: parseInt(inErrors[index]?.value || 0),
        outOctets: parseInt(outOctets[index]?.value || 0),
        outPackets: parseInt(outPackets[index]?.value || 0),
        outErrors: parseInt(outErrors[index]?.value || 0)
      });
    });

    return interfaces;
  } catch (err) {
    // Always log interface errors for debugging
    console.error('[SNMP] Interface error:', err.message);
    return [];
  }
}

// Get system uptime
async function getUptime(session) {
  try {
    const uptime = await getSingleOid(session, OIDS.sysUpTime);
    // Convert from centiseconds to seconds
    return Math.floor(parseInt(uptime) / 100);
  } catch (err) {
    // Suppress NoSuchObject errors (common on Meraki devices)
    if (!err.message.includes('NoSuchObject')) {
      console.error('SNMP Uptime error:', err.message);
    }
    return null;
  }
}

// Get system information (Meraki-supported)
async function getSystemInfo(session) {
  try {
    console.log('[SNMP] Getting system info...');
    const sysInfo = await getMultipleOids(session, [
      OIDS.sysDescr,
      OIDS.sysName
    ]);

    const result = {
      description: sysInfo[OIDS.sysDescr] ? sysInfo[OIDS.sysDescr].toString() : null,
      name: sysInfo[OIDS.sysName] ? sysInfo[OIDS.sysName].toString() : null
    };
    console.log('[SNMP] System info retrieved:', result);
    return result;
  } catch (err) {
    console.error('[SNMP] System Info error:', err.message);
    return { description: null, name: null };
  }
}

// Main function to collect all SNMP metrics
async function collectMetrics(host, community = 'public') {
  console.log(`[SNMP] ========== Starting SNMP collection for ${host} ==========`);
  const session = createSession(host, community);

  try {
    const [cpu, memory, interfaces, uptime, systemInfo] = await Promise.all([
      getCpuUsage(session),
      getMemoryUsage(session),
      getInterfaceStats(session),
      getUptime(session),
      getSystemInfo(session)
    ]);

    session.close();
    console.log(`[SNMP] ========== Collection complete for ${host} ==========`);

    return {
      cpu,
      memory,
      interfaces,
      uptime,
      systemInfo,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error(`[SNMP] ========== Collection FAILED for ${host}: ${err.message} ==========`);
    session.close();
    throw err;
  }
}

module.exports = {
  collectMetrics,
  createSession,
  getCpuUsage,
  getMemoryUsage,
  getInterfaceStats,
  getUptime
};
