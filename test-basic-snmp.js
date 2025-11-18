const snmp = require('net-snmp');

const host = process.argv[2] || '104.51.127.33';
const community = process.argv[3] || 'covenant-technology';

console.log(`Testing basic SNMP OIDs on ${host}...`);

const session = snmp.createSession(host, community, {
  port: 161,
  retries: 1,
  timeout: 5000,
  version: snmp.Version2c
});

// Try the most basic OID - sysDescr
const basicOids = [
  '1.3.6.1.2.1.1.1.0',  // sysDescr
  '1.3.6.1.2.1.1.5.0',  // sysName
  '1.3.6.1.2.1.1.3.0',  // sysUpTime
  '1.3.6.1.2.1.2.1.0',  // ifNumber (number of interfaces)
];

session.get(basicOids, (error, varbinds) => {
  if (error) {
    console.error('ERROR:', error.message);
  } else {
    varbinds.forEach((vb, i) => {
      if (snmp.isVarbindError(vb)) {
        console.log(`${basicOids[i]}: ERROR - ${snmp.varbindError(vb)}`);
      } else {
        console.log(`${basicOids[i]}: ${vb.value}`);
      }
    });
  }
  session.close();
});
