/**
 * Migrate data from Neon to Local PostgreSQL
 * 
 * This script connects to both databases and transfers all data
 */

const { PrismaClient } = require('@prisma/client');

// Neon database URL (your original)
const NEON_URL = "postgresql://neondb_owner:npg_bycMomA7CiY4@ep-long-voice-ahfpgazt-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Local database URL
const LOCAL_URL = "postgresql://postgres:password@localhost:5433/covenant_noc?schema=public";

// Create separate Prisma clients for each database
const neonPrisma = new PrismaClient({
  datasources: { db: { url: NEON_URL } },
  log: ['error']
});

const localPrisma = new PrismaClient({
  datasources: { db: { url: LOCAL_URL } },
  log: ['error']
});

async function migrateTable(tableName, neonQuery, localCreate, transform = (x) => x) {
  try {
    console.log(`\n📦 Migrating ${tableName}...`);
    
    // Fetch from Neon
    const records = await neonQuery();
    console.log(`   Found ${records.length} records in Neon`);
    
    if (records.length === 0) {
      console.log(`   ✓ No data to migrate`);
      return 0;
    }
    
    // Insert into local (skip duplicates)
    let migrated = 0;
    let skipped = 0;
    
    for (const record of records) {
      try {
        const data = transform(record);
        await localCreate(data);
        migrated++;
      } catch (err) {
        if (err.code === 'P2002') {
          // Unique constraint violation - record already exists
          skipped++;
        } else {
          console.error(`   ⚠ Error migrating record:`, err.message);
        }
      }
    }
    
    console.log(`   ✓ Migrated: ${migrated}, Skipped (duplicates): ${skipped}`);
    return migrated;
  } catch (err) {
    console.error(`   ✗ Failed to migrate ${tableName}:`, err.message);
    return 0;
  }
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  Neon → Local PostgreSQL Migration');
  console.log('========================================');
  console.log('');
  console.log('Source: Neon (cloud)');
  console.log('Target: Local Docker PostgreSQL');
  console.log('');

  try {
    // Test connections
    console.log('🔌 Testing connections...');
    
    await neonPrisma.$queryRaw`SELECT 1`;
    console.log('   ✓ Connected to Neon');
    
    await localPrisma.$queryRaw`SELECT 1`;
    console.log('   ✓ Connected to Local DB');

    // Migrate Users first (other tables depend on userId)
    await migrateTable(
      'Users',
      () => neonPrisma.user.findMany(),
      (data) => localPrisma.user.create({ data }),
      (record) => ({
        id: record.id,
        email: record.email,
        password: record.password,
        firstName: record.firstName,
        lastName: record.lastName,
        role: record.role,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })
    );

    // Migrate Sites
    await migrateTable(
      'Sites',
      () => neonPrisma.site.findMany(),
      (data) => localPrisma.site.create({ data }),
      (record) => ({
        id: record.id,
        name: record.name,
        customer: record.customer,
        location: record.location,
        ip: record.ip,
        failoverIp: record.failoverIp,
        latitude: record.latitude,
        longitude: record.longitude,
        isp: record.isp,
        device: record.device,
        devices: record.devices,
        monitoringIcmp: record.monitoringIcmp,
        monitoringSnmp: record.monitoringSnmp,
        snmpCommunity: record.snmpCommunity,
        snmpOid: record.snmpOid,
        monitoringNetflow: record.monitoringNetflow,
        monitoringMeraki: record.monitoringMeraki,
        apiKey: record.apiKey,
        monitoringInterval: record.monitoringInterval,
        dashboardOptions: record.dashboardOptions,
        notes: record.notes,
        status: record.status,
        lastSeen: record.lastSeen,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })
    );

    // Migrate Presets
    await migrateTable(
      'Presets',
      () => neonPrisma.preset.findMany(),
      (data) => localPrisma.preset.create({ data }),
      (record) => ({
        id: record.id,
        name: record.name,
        config: record.config,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })
    );

    // Migrate Refresh Tokens
    await migrateTable(
      'RefreshTokens',
      () => neonPrisma.refreshToken.findMany(),
      (data) => localPrisma.refreshToken.create({ data }),
      (record) => ({
        id: record.id,
        token: record.token,
        userId: record.userId,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt
      })
    );

    // Migrate Audit Logs (can be large, so we limit to recent)
    await migrateTable(
      'AuditLogs (last 30 days)',
      () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return neonPrisma.auditLog.findMany({
          where: { timestamp: { gte: thirtyDaysAgo } }
        });
      },
      (data) => localPrisma.auditLog.create({ data }),
      (record) => ({
        id: record.id,
        userId: record.userId,
        action: record.action,
        details: record.details,
        timestamp: record.timestamp
      })
    );

    // Migrate Monitoring Data (last 7 days only - can be very large)
    await migrateTable(
      'MonitoringData (last 7 days)',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return neonPrisma.monitoringData.findMany({
          where: { timestamp: { gte: sevenDaysAgo } }
        });
      },
      (data) => localPrisma.monitoringData.create({ data }),
      (record) => ({
        id: record.id,
        siteId: record.siteId,
        latency: record.latency,
        packetLoss: record.packetLoss,
        jitter: record.jitter,
        timestamp: record.timestamp
      })
    );

    // Migrate SNMP Data (last 7 days only)
    await migrateTable(
      'SnmpData (last 7 days)',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return neonPrisma.snmpData.findMany({
          where: { timestamp: { gte: sevenDaysAgo } }
        });
      },
      (data) => localPrisma.snmpData.create({ data }),
      (record) => ({
        id: record.id,
        siteId: record.siteId,
        cpuUsage: record.cpuUsage,
        memoryUsage: record.memoryUsage,
        uptime: record.uptime,
        interfaceStats: record.interfaceStats,
        timestamp: record.timestamp
      })
    );

    // Migrate Secrets (if table exists)
    try {
      await migrateTable(
        'Secrets',
        () => neonPrisma.secret.findMany(),
        (data) => localPrisma.secret.create({ data }),
        (record) => ({
          id: record.id,
          name: record.name,
          value: record.value,
          type: record.type,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        })
      );
    } catch (err) {
      console.log('\n📦 Migrating Secrets...');
      console.log('   ⚠ Secrets table not found in Neon (this is OK if you never created secrets)');
    }

    console.log('\n========================================');
    console.log('  Migration Complete!');
    console.log('========================================');
    console.log('');
    console.log('You can now use the local database.');
    console.log('Restart your server to apply changes.');
    console.log('');

  } catch (err) {
    console.error('\n✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await neonPrisma.$disconnect();
    await localPrisma.$disconnect();
  }
}

main();

