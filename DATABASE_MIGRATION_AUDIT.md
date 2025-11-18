# Database Migration Audit: SQLite → Neon PostgreSQL

**Date:** 2025-01-28  
**Status:** Phase 1 - Complete Audit  
**Current Database:** SQLite (file: `./dev.db`)  
**Target Database:** Neon PostgreSQL (serverless)

---

## Table of Contents

1. [Database Schema Overview](#database-schema-overview)
2. [Models & Tables](#models--tables)
3. [Database Usage Locations](#database-usage-locations)
4. [Prisma Client Configuration](#prisma-client-configuration)
5. [Migrations](#migrations)
6. [Scripts Using Database](#scripts-using-database)
7. [API Routes Using Database](#api-routes-using-database)
8. [Monitoring Code](#monitoring-code)
9. [Authentication Code](#authentication-code)
10. [Environment Variables](#environment-variables)
11. [Files Requiring Updates](#files-requiring-updates)
12. [Migration Checklist](#migration-checklist)

---

## Database Schema Overview

### Current Configuration
- **Provider:** SQLite
- **Schema File:** `prisma/schema.prisma`
- **Connection:** `file:./dev.db`
- **Client:** Prisma Client (`@prisma/client`)

### Target Configuration
- **Provider:** PostgreSQL (Neon)
- **Schema File:** `prisma/schema.prisma` (needs update)
- **Connection:** `DATABASE_URL` environment variable
- **Client:** Prisma Client (same, but regenerated)

---

## Models & Tables

### 1. User Model
**File:** `prisma/schema.prisma` (lines 10-21)

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  password      String
  firstName     String?
  lastName      String?
  role          String   @default("user")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  refreshTokens RefreshToken[]
  auditLogs     AuditLog[]
}
```

**Fields:**
- `id` - UUID primary key
- `email` - Unique string (indexed)
- `password` - Hashed password string
- `firstName` - Optional string
- `lastName` - Optional string
- `role` - String (default: "user")
- `createdAt` - DateTime (auto)
- `updatedAt` - DateTime (auto)

**Relationships:**
- One-to-many: `RefreshToken` (cascade delete)
- One-to-many: `AuditLog` (set null on delete)

**Usage Locations:**
- `server/auth/routes.js` - Registration, login, user management
- `server/index.js` - User CRUD operations
- `scripts/reset-password.js` - Password reset utility
- `scripts/reset-password-simple.js` - Simple password reset

---

### 2. RefreshToken Model
**File:** `prisma/schema.prisma` (lines 23-30)

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

**Fields:**
- `id` - UUID primary key
- `token` - Unique string (indexed)
- `userId` - Foreign key to User
- `expiresAt` - DateTime
- `createdAt` - DateTime (auto)

**Relationships:**
- Many-to-one: `User` (cascade delete)

**Usage Locations:**
- `server/auth/routes.js` - Token refresh, logout

---

### 3. Site Model
**File:** `prisma/schema.prisma` (lines 32-58)

```prisma
model Site {
  id                 String   @id @default(uuid())
  name               String
  customer           String
  location           String
  ip                 String
  failoverIp         String?
  latitude           Float?
  longitude          Float?
  isp                String?
  device             String?
  devices            String?
  monitoringIcmp     Boolean  @default(true)
  monitoringSnmp     Boolean  @default(false)
  snmpCommunity      String?
  snmpOid            String?
  monitoringNetflow  Boolean  @default(false)
  monitoringMeraki   Boolean  @default(false)
  apiKey             String?
  notes              String?
  status             String   @default("unknown")
  lastSeen           DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  monitoringData     MonitoringData[]
  snmpData           SnmpData[]
}
```

**Fields:**
- `id` - UUID primary key
- `name` - String
- `customer` - String
- `location` - String
- `ip` - String (primary IP)
- `failoverIp` - Optional string
- `latitude` - Optional float
- `longitude` - Optional float
- `isp` - Optional string
- `device` - Optional string
- `devices` - Optional string
- `monitoringIcmp` - Boolean (default: true)
- `monitoringSnmp` - Boolean (default: false)
- `snmpCommunity` - Optional string
- `snmpOid` - Optional string
- `monitoringNetflow` - Boolean (default: false)
- `monitoringMeraki` - Boolean (default: false)
- `apiKey` - Optional string
- `notes` - Optional string
- `status` - String (default: "unknown")
- `lastSeen` - Optional DateTime
- `createdAt` - DateTime (auto)
- `updatedAt` - DateTime (auto)

**Relationships:**
- One-to-many: `MonitoringData` (cascade delete)
- One-to-many: `SnmpData` (cascade delete)

**Usage Locations:**
- `server/index.js` - Site CRUD operations
- `server/monitoring.js` - Site monitoring, status updates
- `server/index.js` (startup) - Initialize monitoring for all sites

---

### 4. MonitoringData Model
**File:** `prisma/schema.prisma` (lines 60-70)

```prisma
model MonitoringData {
  id        String   @id @default(uuid())
  siteId    String
  site      Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  latency   Float?
  packetLoss Float?
  jitter    Float?
  timestamp DateTime @default(now())

  @@index([siteId, timestamp])
}
```

**Fields:**
- `id` - UUID primary key
- `siteId` - Foreign key to Site
- `latency` - Optional float (milliseconds)
- `packetLoss` - Optional float (percentage)
- `jitter` - Optional float (milliseconds)
- `timestamp` - DateTime (auto, indexed)

**Indexes:**
- Composite index on `[siteId, timestamp]`

**Relationships:**
- Many-to-one: `Site` (cascade delete)

**Usage Locations:**
- `server/index.js` - Fetch monitoring data, history
- `server/monitoring.js` - Create monitoring records, cleanup old data

---

### 5. SnmpData Model
**File:** `prisma/schema.prisma` (lines 72-83)

```prisma
model SnmpData {
  id             String   @id @default(uuid())
  siteId         String
  site           Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  cpuUsage       Float?
  memoryUsage    Float?
  uptime         Int?
  interfaceStats Json?
  timestamp      DateTime @default(now())

  @@index([siteId, timestamp])
}
```

**Fields:**
- `id` - UUID primary key
- `siteId` - Foreign key to Site
- `cpuUsage` - Optional float (percentage)
- `memoryUsage` - Optional float (percentage)
- `uptime` - Optional integer (seconds)
- `interfaceStats` - Optional JSON object
- `timestamp` - DateTime (auto, indexed)

**Indexes:**
- Composite index on `[siteId, timestamp]`

**Relationships:**
- Many-to-one: `Site` (cascade delete)

**Usage Locations:**
- `server/index.js` - Fetch SNMP data
- `server/monitoring.js` - Create SNMP records, cleanup old data

---

### 6. Preset Model
**File:** `prisma/schema.prisma` (lines 85-91)

```prisma
model Preset {
  id        String   @id @default(uuid())
  name      String
  config    Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Fields:**
- `id` - UUID primary key
- `name` - String
- `config` - JSON object
- `createdAt` - DateTime (auto)
- `updatedAt` - DateTime (auto)

**Usage Locations:**
- `server/index.js` - Preset CRUD operations

---

### 7. AuditLog Model
**File:** `prisma/schema.prisma` (lines 93-102)

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action    String
  details   Json?
  timestamp DateTime @default(now())

  @@index([timestamp])
}
```

**Fields:**
- `id` - UUID primary key
- `userId` - Optional foreign key to User
- `action` - String (action type)
- `details` - Optional JSON object
- `timestamp` - DateTime (auto, indexed)

**Indexes:**
- Index on `timestamp`

**Relationships:**
- Many-to-one: `User` (set null on delete)

**Usage Locations:**
- `server/index.js` - Audit log CRUD, audit trail for all operations
- `server/auth/routes.js` - Audit trail for auth operations

---

## Database Usage Locations

### Core Files

1. **`server/prisma.js`**
   - Prisma Client initialization
   - Connection configuration
   - Graceful shutdown handling
   - **Status:** ✅ Needs update (datasource URL)

2. **`prisma/schema.prisma`**
   - Complete schema definition
   - All models, relationships, indexes
   - **Status:** ⚠️ Needs update (datasource provider)

3. **`prisma.config.ts`**
   - Prisma configuration
   - Migration path configuration
   - **Status:** ✅ May need update

---

### API Routes (`server/index.js`)

**Lines 113-197:** Sites Routes
- `GET /api/sites` - `prisma.site.findMany()`
- `POST /api/sites` - `prisma.site.create()`, `prisma.auditLog.create()`
- `PUT /api/sites/:id` - `prisma.site.update()`, `prisma.auditLog.create()`
- `DELETE /api/sites/:id` - `prisma.site.findUnique()`, `prisma.site.delete()`, `prisma.auditLog.create()`
- `DELETE /api/sites` - `prisma.site.deleteMany()`, `prisma.auditLog.create()`

**Lines 200-255:** Monitoring Routes
- `GET /api/monitoring/:siteId` - `prisma.monitoringData.findFirst()`
- `GET /api/monitoring/:siteId/history` - `prisma.monitoringData.findMany()`
- `GET /api/monitoring/:siteId/snmp` - `prisma.snmpData.findFirst()`
- `GET /api/monitoring/:siteId/meraki` - `prisma.site.findUnique()`

**Lines 258-296:** Presets Routes
- `GET /api/presets` - `prisma.preset.findMany()`
- `POST /api/presets` - `prisma.preset.create()`
- `PUT /api/presets/:id` - `prisma.preset.update()`
- `DELETE /api/presets/:id` - `prisma.preset.delete()`

**Lines 299-318:** Audit Log Routes
- `GET /api/audit` - `prisma.auditLog.findMany()` with `include: { user }`
- `POST /api/audit` - `prisma.auditLog.create()`

**Lines 321-471:** User Management Routes
- `GET /api/users` - `prisma.user.findMany()`
- `POST /api/users` - `prisma.user.findUnique()`, `prisma.user.create()`, `prisma.auditLog.create()`
- `PUT /api/users/:id` - `prisma.user.findFirst()`, `prisma.user.update()`, `prisma.auditLog.create()`
- `DELETE /api/users/:id` - `prisma.user.count()`, `prisma.user.findUnique()`, `prisma.user.delete()`, `prisma.auditLog.create()`

**Lines 497-509:** Server Startup
- `prisma.site.findMany()` - Initialize monitoring for existing sites

---

### Authentication (`server/auth/routes.js`)

**Lines 13-82:** Registration
- `prisma.user.findUnique()` - Check existing user
- `prisma.user.create()` - Create new user
- `prisma.refreshToken.create()` - Store refresh token
- `prisma.auditLog.create()` - Audit trail

**Lines 88-155:** Login
- `prisma.user.findUnique()` - Find user
- `prisma.refreshToken.deleteMany()` - Clean up old tokens
- `prisma.refreshToken.create()` - Store new token
- `prisma.auditLog.create()` - Audit trail

**Lines 161-215:** Token Refresh
- `prisma.refreshToken.findUnique()` - Find token with user
- `prisma.refreshToken.delete()` - Delete old token
- `prisma.refreshToken.create()` - Store new token

**Lines 221-247:** Logout
- `prisma.refreshToken.deleteMany()` - Invalidate tokens
- `prisma.auditLog.create()` - Audit trail

**Lines 253-278:** Get Current User
- `prisma.user.findUnique()` - Get user info

---

### Monitoring (`server/monitoring.js`)

**Lines 86-106:** Monitor Site
- `prisma.site.findUnique()` - Check site exists
- `prisma.monitoringData.create()` - Store monitoring metrics
- `prisma.snmpData.create()` - Store SNMP metrics
- `prisma.site.update()` - Update site status

**Lines 178-188:** Start Monitoring for User
- `prisma.site.findMany()` - Get all sites for user

**Lines 192-196:** Get Latest Metrics
- `prisma.monitoringData.findFirst()` - Get latest data

**Lines 199-210:** Get Metrics History
- `prisma.monitoringData.findMany()` - Get historical data

**Lines 213-218:** Get Latest SNMP Metrics
- `prisma.snmpData.findFirst()` - Get latest SNMP data

**Lines 221-242:** Calculate Uptime
- `prisma.site.findUnique()` - Get site with monitoring data
- Includes `monitoringData` relation

**Lines 245-260:** Cleanup Old Data
- `prisma.monitoringData.deleteMany()` - Delete old monitoring data
- `prisma.snmpData.deleteMany()` - Delete old SNMP data

---

### Scripts

1. **`scripts/reset-password.js`**
   - `prisma.user.findMany()` - List users
   - `prisma.user.findUnique()` - Find user
   - `prisma.user.update()` - Update password
   - `prisma.user.create()` - Create user
   - **Status:** ✅ Needs update (connection string)

2. **`scripts/reset-password-simple.js`**
   - `prisma.user.findUnique()` - Find user
   - `prisma.user.update()` - Update password
   - **Status:** ✅ Needs update (connection string)

---

## Prisma Client Configuration

### Current Setup (`server/prisma.js`)

```javascript
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
```

**Status:** ✅ Good - No changes needed (will auto-use DATABASE_URL)

---

## Migrations

### Existing Migrations

1. **`prisma/migrations/20251028161810_init/migration.sql`**
   - Initial schema creation
   - Creates all 7 tables
   - Creates indexes
   - **Status:** ⚠️ SQLite-specific syntax, needs PostgreSQL conversion

2. **`prisma/migrations/20251028174715_add_missing_site_fields/migration.sql`**
   - Adds `device`, `devices`, `isp` columns to Site table
   - **Status:** ⚠️ SQLite-specific syntax, needs PostgreSQL conversion

3. **`prisma/migrations/migration_lock.toml`**
   - Migration lock file
   - **Status:** ⚠️ Needs update (provider change)

### Legacy Migration Scripts (Not Using Prisma)

1. **`server/migrate.js`**
   - SQLite-specific migration
   - Uses `better-sqlite3`
   - **Status:** ❌ Deprecated, can be removed

2. **`server/migrate-users.js`**
   - SQLite-specific migration
   - Uses `better-sqlite3`
   - **Status:** ❌ Deprecated, can be removed

3. **`server/migrate-snmp.js`**
   - SQLite-specific migration
   - Uses `better-sqlite3`
   - **Status:** ❌ Deprecated, can be removed

---

## Environment Variables

### Current Configuration

**File:** `.env` (if exists) or environment

**Required Variables:**
- `DATABASE_URL` - Currently: `file:./dev.db` (SQLite)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)

**Status:** ⚠️ `DATABASE_URL` needs to be updated to Neon PostgreSQL connection string

### Expected Neon Format

```
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
```

---

## Files Requiring Updates

### Critical Files (Must Update)

1. **`prisma/schema.prisma`**
   - Change datasource provider from `sqlite` to `postgresql`
   - Update datasource URL to use `env("DATABASE_URL")`
   - Verify all field types are PostgreSQL-compatible
   - **Priority:** 🔴 CRITICAL

2. **`server/prisma.js`**
   - No changes needed (uses DATABASE_URL automatically)
   - **Priority:** ✅ No changes

3. **`prisma/migrations/`** (all migration files)
   - Convert SQLite syntax to PostgreSQL
   - Update `migration_lock.toml` provider
   - **Priority:** 🔴 CRITICAL

### Data Migration Scripts (New)

4. **`scripts/migrate-data-to-neon.js`** (NEW)
   - Export data from SQLite
   - Import data to Neon PostgreSQL
   - **Priority:** 🟡 HIGH

### Documentation Files (Update)

5. **`README.md`**
   - Update database setup instructions
   - **Priority:** 🟢 MEDIUM

6. **`QUICK_START.md`**
   - Update database setup instructions
   - **Priority:** 🟢 MEDIUM

7. **`CLERK_NEON_SETUP.md`**
   - Already has Neon instructions (may need updates)
   - **Priority:** 🟢 MEDIUM

### Deprecated Files (Can Remove)

8. **`server/migrate.js`**
   - SQLite-specific, deprecated
   - **Priority:** 🟢 LOW (remove after migration)

9. **`server/migrate-users.js`**
   - SQLite-specific, deprecated
   - **Priority:** 🟢 LOW (remove after migration)

10. **`server/migrate-snmp.js`**
    - SQLite-specific, deprecated
    - **Priority:** 🟢 LOW (remove after migration)

11. **`server/db.js`** (if exists)
    - Old Neon setup file
    - **Priority:** 🟢 LOW (review and remove if obsolete)

12. **`server/db-neon.js`** (if exists)
    - Old Neon setup file
    - **Priority:** 🟢 LOW (review and remove if obsolete)

13. **`server/db-old-sqlite.js`** (if exists)
    - Old SQLite setup file
    - **Priority:** 🟢 LOW (remove)

---

## Migration Checklist

### Phase 1: Audit ✅
- [x] Document all database models
- [x] Document all database usage locations
- [x] Document all API routes using database
- [x] Document all scripts using database
- [x] Document environment variables
- [x] Create comprehensive audit document

### Phase 2: Preparation (Pending)
- [ ] Get Neon PostgreSQL connection string
- [ ] Backup current SQLite database
- [ ] Test Neon connection
- [ ] Review schema compatibility

### Phase 3: Schema Migration (Pending)
- [ ] Update `prisma/schema.prisma` datasource to PostgreSQL
- [ ] Convert existing migrations to PostgreSQL syntax
- [ ] Update `migration_lock.toml`
- [ ] Generate new Prisma Client
- [ ] Test schema generation

### Phase 4: Data Migration (Pending)
- [ ] Create data export script from SQLite
- [ ] Create data import script to Neon
- [ ] Test data migration with sample data
- [ ] Run full data migration
- [ ] Verify data integrity

### Phase 5: Code Updates (Pending)
- [ ] Update all scripts to use new connection
- [ ] Remove deprecated migration scripts
- [ ] Update documentation
- [ ] Test all API endpoints
- [ ] Test monitoring functionality
- [ ] Test authentication flows

### Phase 6: Verification (Pending)
- [ ] Run comprehensive test suite
- [ ] Verify all database queries work
- [ ] Verify all relationships work
- [ ] Verify indexes are created
- [ ] Verify data integrity
- [ ] Performance testing

### Phase 7: Cleanup (Pending)
- [ ] Remove SQLite database file
- [ ] Remove deprecated migration scripts
- [ ] Update `.gitignore` if needed
- [ ] Final documentation update

---

## SQLite to PostgreSQL Compatibility Notes

### Data Types
- ✅ `TEXT` → `TEXT` (same)
- ✅ `INTEGER` → `INTEGER` (same)
- ✅ `REAL` → `REAL` (same)
- ✅ `BOOLEAN` → `BOOLEAN` (same)
- ✅ `DATETIME` → `TIMESTAMP` (needs conversion)
- ✅ `JSONB` → `JSONB` (same in Prisma)

### Prisma Schema
- ✅ UUID generation works the same
- ✅ Relationships work the same
- ✅ Indexes work the same
- ⚠️ `@default(now())` works but may need `CURRENT_TIMESTAMP` in raw SQL
- ⚠️ `@updatedAt` works automatically

### Migrations
- ⚠️ SQLite uses `CREATE TABLE` syntax
- ⚠️ PostgreSQL uses `CREATE TABLE` with different constraints
- ⚠️ Foreign keys syntax differs slightly
- ⚠️ Index creation syntax differs

### Functions
- ⚠️ `CURRENT_TIMESTAMP` works in both
- ⚠️ Date functions may differ
- ⚠️ JSON functions differ (but Prisma handles this)

---

## Summary

### Total Models: 7
1. User
2. RefreshToken
3. Site
4. MonitoringData
5. SnmpData
6. Preset
7. AuditLog

### Total Files Using Database: 8
1. `server/prisma.js` (client initialization)
2. `server/index.js` (API routes)
3. `server/auth/routes.js` (authentication)
4. `server/monitoring.js` (monitoring)
5. `scripts/reset-password.js` (utility)
6. `scripts/reset-password-simple.js` (utility)
7. `prisma/schema.prisma` (schema definition)
8. `prisma/migrations/` (migration files)

### Total API Endpoints Using Database: 20+
- Sites: 5 endpoints
- Monitoring: 4 endpoints
- Presets: 4 endpoints
- Audit: 2 endpoints
- Users: 4 endpoints
- Auth: 4 endpoints

### Critical Changes Required: 3
1. Update `prisma/schema.prisma` datasource
2. Convert migrations to PostgreSQL
3. Create data migration script

### Estimated Migration Time: 4-6 hours
- Schema migration: 1 hour
- Data migration: 1-2 hours
- Testing: 2-3 hours

---

**END OF AUDIT**

