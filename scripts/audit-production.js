#!/usr/bin/env node
/**
 * Production Audit Script
 * Tests database connectivity and data integrity
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function audit() {
  console.log('');
  console.log('🔍 Production Audit');
  console.log('==================');
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // Test 1: Database Connection
  console.log('1. Database Connection');
  try {
    await prisma.$connect();
    console.log('   ✅ Connected to database');
    results.passed++;
  } catch (e) {
    console.log('   ❌ Failed to connect:', e.message);
    results.failed++;
    process.exit(1);
  }

  // Test 2: Check DATABASE_URL
  console.log('');
  console.log('2. Database URL Check');
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('neon.tech')) {
    console.log('   ⚠️  WARNING: Still using Neon database URL!');
    results.warnings++;
  } else if (dbUrl.includes('localhost')) {
    console.log('   ✅ Using local PostgreSQL');
    results.passed++;
  } else {
    console.log('   ℹ️  Database:', dbUrl.split('@')[1]?.split('/')[0] || 'unknown');
    results.passed++;
  }

  // Test 3: Count Records
  console.log('');
  console.log('3. Database Records');
  try {
    const counts = {
      users: await prisma.user.count(),
      sites: await prisma.site.count(),
      monitoringData: await prisma.monitoringData.count(),
      snmpData: await prisma.snmpData.count(),
      presets: await prisma.preset.count(),
      auditLogs: await prisma.auditLog.count(),
      refreshTokens: await prisma.refreshToken.count(),
      systemSettings: await prisma.systemSettings.count()
    };

    console.log('   Users:           ', counts.users);
    console.log('   Sites:           ', counts.sites);
    console.log('   Monitoring Data: ', counts.monitoringData);
    console.log('   SNMP Data:       ', counts.snmpData);
    console.log('   Presets:         ', counts.presets);
    console.log('   Audit Logs:      ', counts.auditLogs);
    console.log('   Refresh Tokens:  ', counts.refreshTokens);
    console.log('   System Settings: ', counts.systemSettings);

    if (counts.users === 0) {
      console.log('   ⚠️  No users found - run: node scripts/create-admin.js');
      results.warnings++;
    } else {
      results.passed++;
    }

    if (counts.sites === 0) {
      console.log('   ⚠️  No sites found');
      results.warnings++;
    } else {
      results.passed++;
    }
  } catch (e) {
    console.log('   ❌ Failed to count records:', e.message);
    results.failed++;
  }

  // Test 4: Check Admin User
  console.log('');
  console.log('4. Admin User Check');
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });
    if (admin) {
      console.log('   ✅ Admin user exists:', admin.email);
      results.passed++;
    } else {
      console.log('   ❌ No admin user found!');
      console.log('   Run: node scripts/create-admin.js');
      results.failed++;
    }
  } catch (e) {
    console.log('   ❌ Failed to check admin:', e.message);
    results.failed++;
  }

  // Test 5: System Settings
  console.log('');
  console.log('5. System Settings');
  try {
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });
    if (settings) {
      console.log('   ✅ System settings exist');
      console.log('      Session Timeout:', settings.sessionTimeoutMinutes === 0 ? 'Never (Infinite)' : `${settings.sessionTimeoutMinutes} minutes`);
      console.log('      Data Retention:', settings.dataRetentionDays === 0 ? 'Forever' : `${settings.dataRetentionDays} days`);
      results.passed++;
    } else {
      console.log('   ℹ️  Creating default system settings...');
      settings = await prisma.systemSettings.create({
        data: { id: 'system' }
      });
      console.log('   ✅ Default settings created');
      results.passed++;
    }
  } catch (e) {
    console.log('   ❌ Failed to check settings:', e.message);
    results.failed++;
  }

  // Test 6: Test Site Export Query
  console.log('');
  console.log('6. Export Sites Query Test');
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log('   ✅ Export query works -', sites.length, 'sites returned');
    results.passed++;
  } catch (e) {
    console.log('   ❌ Export query failed:', e.message);
    results.failed++;
  }

  // Summary
  console.log('');
  console.log('==================');
  console.log('📊 Audit Summary');
  console.log('==================');
  console.log(`   ✅ Passed:   ${results.passed}`);
  console.log(`   ⚠️  Warnings: ${results.warnings}`);
  console.log(`   ❌ Failed:   ${results.failed}`);
  console.log('');

  if (results.failed > 0) {
    console.log('❌ Audit FAILED - Fix the issues above');
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log('⚠️  Audit passed with warnings');
  } else {
    console.log('✅ Audit PASSED - All systems operational');
  }

  await prisma.$disconnect();
}

audit().catch(e => {
  console.error('Audit error:', e);
  process.exit(1);
});

