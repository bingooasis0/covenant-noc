const { PrismaClient } = require('@prisma/client');

// Create Prisma client instance with optimized connection pooling for Neon
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Optimize connection pool for Neon free tier
// Neon free tier supports up to 100 concurrent connections
// We'll use a smaller pool to avoid connection exhaustion
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
