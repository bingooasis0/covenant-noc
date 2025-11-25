const { PrismaClient } = require('@prisma/client');

// Create Prisma client instance optimized for local database
// No connection limits - use maximum performance for local PostgreSQL
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Connect immediately for local database (no pooling limits)
if (prisma.$connect) {
  prisma.$connect().catch(err => {
    console.error('[Prisma] Connection error:', err.message);
  });
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Handle connection errors gracefully (if supported)
if (prisma.$on) {
  prisma.$on('error', (e) => {
    console.error('[Prisma] Error:', e);
  });
}

module.exports = prisma;
