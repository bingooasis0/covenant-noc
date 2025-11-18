/**
 * Data Migration Script: SQLite → Neon PostgreSQL
 * 
 * This script exports all data from SQLite and imports it into Neon PostgreSQL.
 * Includes storage limit checking to ensure we don't exceed Neon free tier limits.
 * 
 * Usage:
 *   1. Make sure DATABASE_URL in .env points to Neon PostgreSQL
 *   2. Make sure SQLite database file exists at ./prisma/dev.db
 *   3. Run: node scripts/migrate-data-to-neon.js
 */

const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();
const limits = require('../server/limits');

const sqliteDbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const prisma = new PrismaClient();

// Check if SQLite database exists
if (!require('fs').existsSync(sqliteDbPath)) {
  console.error(`❌ SQLite database not found at: ${sqliteDbPath}`);
  console.log('   If your database is in a different location, update sqliteDbPath in this script.');
  process.exit(1);
}

// Verify Neon connection
async function verifyNeonConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to Neon PostgreSQL');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Neon PostgreSQL:', error.message);
    console.log('\n   Make sure DATABASE_URL in .env is set to your Neon connection string.');
    return false;
  }
}

// Export data from SQLite
function exportFromSQLite() {
  console.log('\n📦 Exporting data from SQLite...');
  const db = new Database(sqliteDbPath);

  const data = {
    users: [],
    refreshTokens: [],
    sites: [],
    monitoringData: [],
    snmpData: [],
    presets: [],
    auditLogs: []
  };

  try {
    // Export Users
    const users = db.prepare('SELECT * FROM User').all();
    data.users = users.map(u => ({
      id: u.id,
      email: u.email,
      password: u.password,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
      updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date()
    }));
    console.log(`   ✓ Exported ${data.users.length} users`);

    // Export RefreshTokens
    const refreshTokens = db.prepare('SELECT * FROM RefreshToken').all();
    data.refreshTokens = refreshTokens.map(rt => ({
      id: rt.id,
      token: rt.token,
      userId: rt.userId,
      expiresAt: rt.expiresAt ? new Date(rt.expiresAt) : new Date(),
      createdAt: rt.createdAt ? new Date(rt.createdAt) : new Date()
    }));
    console.log(`   ✓ Exported ${data.refreshTokens.length} refresh tokens`);

    // Export Sites
    const sites = db.prepare('SELECT * FROM Site').all();
    data.sites = sites.map(s => ({
      id: s.id,
      name: s.name,
      customer: s.customer,
      location: s.location,
      ip: s.ip,
      failoverIp: s.failoverIp,
      latitude: s.latitude,
      longitude: s.longitude,
      isp: s.isp,
      device: s.device,
      devices: s.devices,
      monitoringIcmp: s.monitoringIcmp === 1,
      monitoringSnmp: s.monitoringSnmp === 1,
      snmpCommunity: s.snmpCommunity,
      snmpOid: s.snmpOid,
      monitoringNetflow: s.monitoringNetflow === 1,
      monitoringMeraki: s.monitoringMeraki === 1,
      apiKey: s.apiKey,
      notes: s.notes,
      status: s.status,
      lastSeen: s.lastSeen ? new Date(s.lastSeen) : null,
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date()
    }));
    console.log(`   ✓ Exported ${data.sites.length} sites`);

    // Export MonitoringData
    const monitoringData = db.prepare('SELECT * FROM MonitoringData').all();
    data.monitoringData = monitoringData.map(md => ({
      id: md.id,
      siteId: md.siteId,
      latency: md.latency,
      packetLoss: md.packetLoss,
      jitter: md.jitter,
      timestamp: md.timestamp ? new Date(md.timestamp) : new Date()
    }));
    console.log(`   ✓ Exported ${data.monitoringData.length} monitoring data records`);

    // Export SnmpData
    const snmpData = db.prepare('SELECT * FROM SnmpData').all();
    data.snmpData = snmpData.map(sd => ({
      id: sd.id,
      siteId: sd.siteId,
      cpuUsage: sd.cpuUsage,
      memoryUsage: sd.memoryUsage,
      uptime: sd.uptime,
      interfaceStats: typeof sd.interfaceStats === 'string' ? JSON.parse(sd.interfaceStats) : sd.interfaceStats,
      timestamp: sd.timestamp ? new Date(sd.timestamp) : new Date()
    }));
    console.log(`   ✓ Exported ${data.snmpData.length} SNMP data records`);

    // Export Presets
    const presets = db.prepare('SELECT * FROM Preset').all();
    data.presets = presets.map(p => ({
      id: p.id,
      name: p.name,
      config: typeof p.config === 'string' ? JSON.parse(p.config) : p.config,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date()
    }));
    console.log(`   ✓ Exported ${data.presets.length} presets`);

    // Export AuditLogs
    const auditLogs = db.prepare('SELECT * FROM AuditLog').all();
    data.auditLogs = auditLogs.map(al => ({
      id: al.id,
      userId: al.userId,
      action: al.action,
      details: typeof al.details === 'string' ? JSON.parse(al.details) : al.details,
      timestamp: al.timestamp ? new Date(al.timestamp) : new Date()
    }));
    console.log(`   ✓ Exported ${data.auditLogs.length} audit log records`);

    db.close();
    console.log('✅ Export complete!\n');
    return data;
  } catch (error) {
    db.close();
    console.error('❌ Export failed:', error.message);
    throw error;
  }
}

// Import data to Neon PostgreSQL
async function importToNeon(data) {
  console.log('📥 Importing data to Neon PostgreSQL...\n');

  // Check storage limits before importing
  console.log('📊 Checking storage limits...');
  const usage = await limits.estimateStorageUsage();
  if (usage && usage.isOverLimit) {
    console.error(`❌ Current storage usage (${usage.totalGB} GB) already exceeds limit (${usage.limitGB} GB)`);
    console.log('   Please clean up existing data before migrating.');
    process.exit(1);
  }

  // Estimate total data size
  const estimatedSize = 
    (data.users.length * 500) +
    (data.sites.length * 800) +
    (data.monitoringData.length * 100) +
    (data.snmpData.length * 200) +
    (data.presets.length * 500) +
    (data.auditLogs.length * 300) +
    (data.refreshTokens.length * 200);
  
  const estimatedGB = estimatedSize / (1024 * 1024 * 1024);
  console.log(`   Estimated data size: ${Math.round(estimatedGB * 1000) / 1000} GB`);

  const check = await limits.checkStorageLimit(estimatedSize);
  if (!check.allowed) {
    console.error(`❌ Cannot import: ${check.reason}`);
    console.log('   Consider cleaning up old monitoring/SNMP data before migrating.');
    process.exit(1);
  }

  console.log(`   ✓ Storage check passed (projected: ${check.projectedGB} GB / ${check.currentUsage.limitGB} GB)\n`);

  try {
    // Import Users
    if (data.users.length > 0) {
      for (const user of data.users) {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {},
          create: user
        });
      }
      console.log(`   ✓ Imported ${data.users.length} users`);
    }

    // Import RefreshTokens
    if (data.refreshTokens.length > 0) {
      for (const token of data.refreshTokens) {
        await prisma.refreshToken.upsert({
          where: { id: token.id },
          update: {},
          create: token
        });
      }
      console.log(`   ✓ Imported ${data.refreshTokens.length} refresh tokens`);
    }

    // Import Sites
    if (data.sites.length > 0) {
      for (const site of data.sites) {
        await prisma.site.upsert({
          where: { id: site.id },
          update: {},
          create: site
        });
      }
      console.log(`   ✓ Imported ${data.sites.length} sites`);
    }

    // Import MonitoringData
    if (data.monitoringData.length > 0) {
      // Batch insert for performance
      const batchSize = 100;
      for (let i = 0; i < data.monitoringData.length; i += batchSize) {
        const batch = data.monitoringData.slice(i, i + batchSize);
        await prisma.monitoringData.createMany({
          data: batch,
          skipDuplicates: true
        });
      }
      console.log(`   ✓ Imported ${data.monitoringData.length} monitoring data records`);
    }

    // Import SnmpData
    if (data.snmpData.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < data.snmpData.length; i += batchSize) {
        const batch = data.snmpData.slice(i, i + batchSize);
        await prisma.snmpData.createMany({
          data: batch,
          skipDuplicates: true
        });
      }
      console.log(`   ✓ Imported ${data.snmpData.length} SNMP data records`);
    }

    // Import Presets
    if (data.presets.length > 0) {
      for (const preset of data.presets) {
        await prisma.preset.upsert({
          where: { id: preset.id },
          update: {},
          create: preset
        });
      }
      console.log(`   ✓ Imported ${data.presets.length} presets`);
    }

    // Import AuditLogs
    if (data.auditLogs.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < data.auditLogs.length; i += batchSize) {
        const batch = data.auditLogs.slice(i, i + batchSize);
        await prisma.auditLog.createMany({
          data: batch,
          skipDuplicates: true
        });
      }
      console.log(`   ✓ Imported ${data.auditLogs.length} audit log records`);
    }

    console.log('\n✅ Import complete!');
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    throw error;
  }
}

// Main migration function
async function main() {
  console.log('🚀 Starting data migration from SQLite to Neon PostgreSQL\n');
  console.log('=' .repeat(60));

  // Verify Neon connection
  const connected = await verifyNeonConnection();
  if (!connected) {
    process.exit(1);
  }

  try {
    // Export from SQLite
    const data = exportFromSQLite();

    // Import to Neon
    await importToNeon(data);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test your application: npm run dev');
    console.log('2. Verify all data is accessible');
    console.log('3. Once verified, you can backup/remove the SQLite database');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();

