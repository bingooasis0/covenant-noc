const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking local database...\n');
    
    const sites = await prisma.site.count();
    const users = await prisma.user.count();
    const monitoringData = await prisma.monitoringData.count();
    const snmpData = await prisma.snmpData.count();
    const presets = await prisma.preset.count();
    const auditLogs = await prisma.auditLog.count();
    
    console.log('Database Status:');
    console.log(`  Sites: ${sites}`);
    console.log(`  Users: ${users}`);
    console.log(`  Monitoring Data: ${monitoringData}`);
    console.log(`  SNMP Data: ${snmpData}`);
    console.log(`  Presets: ${presets}`);
    console.log(`  Audit Logs: ${auditLogs}`);
    
    if (sites === 0 && users === 0) {
      console.log('\n⚠️  Database is empty - you may want to migrate data from Neon');
    } else {
      console.log('\n✓ Database has data');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

