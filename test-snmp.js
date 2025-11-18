const snmp = require('./server/snmp');

// Test SNMP connectivity
async function testSnmp() {
  const host = process.argv[2] || '104.51.127.33';
  const community = process.argv[3] || 'covenant-technology';

  console.log(`\n===== SNMP Connectivity Test =====`);
  console.log(`Target: ${host}`);
  console.log(`Community: ${community}`);
  console.log(`Port: 161 (UDP)`);
  console.log(`Timeout: 5000ms\n`);

  try {
    console.log('Attempting to collect SNMP metrics...\n');
    const metrics = await snmp.collectMetrics(host, community);

    console.log('\n✓ SUCCESS! SNMP data collected:\n');
    console.log('System Info:', metrics.systemInfo);
    console.log('Uptime (seconds):', metrics.uptime);
    console.log('CPU Usage:', metrics.cpu);
    console.log('Memory:', metrics.memory);
    console.log('Interface Count:', metrics.interfaces?.length || 0);

    if (metrics.interfaces && metrics.interfaces.length > 0) {
      console.log('\nInterfaces:');
      metrics.interfaces.forEach(iface => {
        console.log(`  - ${iface.name}: ${iface.status} (MAC: ${iface.macAddress})`);
        console.log(`    In: ${iface.inPackets} packets / ${iface.inOctets} bytes`);
        console.log(`    Out: ${iface.outPackets} packets / ${iface.outOctets} bytes`);
      });
    }
  } catch (err) {
    console.error('\n✗ FAILED! Error:', err.message);
    console.error('\nPossible issues:');
    console.error('1. Firewall blocking UDP port 161 on the target device');
    console.error('2. SNMP not enabled or wrong community string');
    console.error('3. Need to use device LAN IP instead of public WAN IP');
    console.error('4. Network routing issue between server and device\n');
    process.exit(1);
  }
}

testSnmp();
