const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : 'NOT SET');
    
    // Test connection
    await prisma.$connect();
    console.log('✓ Connected to database');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✓ Query test successful:', result);
    
    // Check if we can read data
    const siteCount = await prisma.site.count();
    console.log(`✓ Can read data: ${siteCount} sites found`);
    
    console.log('\n✓ Database connection is working correctly!');
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

