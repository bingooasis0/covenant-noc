#!/usr/bin/env node
/**
 * Create Admin User Script
 * Creates or resets admin user with default credentials
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// Default admin credentials
const ADMIN_EMAIL = 'colby@covenanttechnology.net';
const ADMIN_PASSWORD = 'Covenant2024!';
const ADMIN_FIRST_NAME = 'Colby';
const ADMIN_LAST_NAME = 'Admin';

async function createAdmin() {
  console.log('');
  console.log('🔐 Creating Admin User');
  console.log('======================');
  console.log('');
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Hash password
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    // Create or update admin user
    const user = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { 
        password: hashedPassword,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        role: 'admin'
      },
      create: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        role: 'admin'
      }
    });
    
    console.log('✅ Admin user created/updated');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log('   Email:    ' + ADMIN_EMAIL);
    console.log('   Password: ' + ADMIN_PASSWORD);
    console.log('');
    console.log('🌐 Login at: http://10.1.0.10:3000');
    console.log('');
    console.log('⚠️  IMPORTANT: Change your password after logging in!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

