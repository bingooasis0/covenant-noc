require('dotenv').config();
const prisma = require('../server/prisma');

async function test() {
  try {
    console.log('Testing server database connection...');
    const site = await prisma.site.findFirst();
    console.log('✓ Database connection successful');
    console.log('✓ Sample site:', site ? site.name : 'No sites');
    await prisma.$disconnect();
  } catch (error) {
    console.error('✗ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

test();

