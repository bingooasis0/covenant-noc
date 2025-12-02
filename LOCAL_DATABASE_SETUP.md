# Local Database Setup - Complete ✅

Your local PostgreSQL database is now set up and working correctly!

## What Was Done

1. ✅ **Docker PostgreSQL Container**: Already running on port 5433
2. ✅ **Database Schema**: Prisma migrations applied successfully
3. ✅ **Data Migration**: Local database already contains:
   - 7 sites
   - 1 user
   - 262,383 monitoring data records
   - 3,568 SNMP data records
   - 1 audit log
4. ✅ **Configuration**: `.env` file configured for local database
5. ✅ **Limits Module**: Updated to skip Neon limit checks for local databases
6. ✅ **Migration Script**: Updated to support environment variables

## Current Database Status

- **Database**: `covenant_noc` (PostgreSQL 15)
- **Host**: `localhost:5433`
- **Connection**: Working correctly ✅
- **Data**: Already migrated from Neon ✅

## Environment Configuration

Your `.env` file is configured with:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5433/covenant_noc?schema=public"
```

## Running the Application

### Start Development Server
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3000`
- Frontend dev server on `http://localhost:5173` (or port 3001)

### Start Production Server
```bash
npm start
```

## Migrating Additional Data from Neon (Optional)

If you need to migrate more data from Neon:

1. **Set Neon URL** (optional - script has a fallback):
   ```bash
   # Add to .env file
   NEON_DATABASE_URL="postgresql://user:pass@your-neon-host/neondb?sslmode=require"
   ```

2. **Run Migration Script**:
   ```bash
   node scripts/migrate-from-neon.js
   ```

   The script will:
   - Compare Neon vs Local database
   - Only migrate if Neon has more data
   - Skip duplicates automatically

## Database Management

### Check Database Status
```bash
node scripts/check-local-db.js
```

### Test Database Connection
```bash
node scripts/test-db-connection.js
```

### Access Database Directly
```bash
# Using psql (if installed)
psql -h localhost -p 5433 -U postgres -d covenant_noc

# Password: password
```

### View Database in Prisma Studio
```bash
npx prisma studio
```

## Docker Commands

### Start Database Container
```bash
docker-compose up -d
```

### Stop Database Container
```bash
docker-compose down
```

### View Database Logs
```bash
docker logs covenant_noc_db
```

### Restart Database Container
```bash
docker-compose restart db
```

## Important Notes

1. **No Neon Limits**: The limits module now skips all checks for local databases
2. **Unlimited Storage**: Local database has no storage limits
3. **No Network Transfer Limits**: No restrictions on data transfer
4. **Production**: Your production server on Ubuntu uses a different database configuration

## Troubleshooting

### Database Connection Fails
1. Check if Docker is running: `docker ps`
2. Check if container is running: `docker ps | grep covenant_noc_db`
3. Start container: `docker-compose up -d`
4. Check logs: `docker logs covenant_noc_db`

### Port Already in Use
If port 5433 is already in use, you can change it in `docker-compose.yml`:
```yaml
ports:
  - "5434:5432"  # Change 5433 to 5434
```

Then update `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5434/covenant_noc?schema=public"
```

### Reset Database (⚠️ Deletes All Data)
```bash
npx prisma migrate reset
```

This will:
- Drop all tables
- Recreate schema
- Run all migrations
- **WARNING**: All data will be lost!

## Next Steps

1. ✅ Local database is ready to use
2. ✅ Start developing: `npm run dev`
3. ✅ All data is already migrated
4. ✅ No Neon subscription needed for local development

Your local database is fully functional and ready for development! 🎉

