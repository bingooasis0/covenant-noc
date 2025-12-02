# Production Deployment Fix - Polling Interval & Database

## ✅ Fixed Issues

1. **Polling Interval Not Updating** - Fixed! Monitoring now properly restarts with new interval
2. **Database Connection Error** - Need to configure production database

## Quick Deploy to Production

SSH into your Ubuntu server and run:

```bash
cd covenant-noc
git pull origin main
npm install
npm run build
pm2 restart covenant-noc
```

## Database Issue Fix

Your production server is trying to connect to Neon database which isn't accessible. You have two options:

### Option 1: Use Local PostgreSQL on Ubuntu Server (Recommended)

1. **Install PostgreSQL** (if not already installed):
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib -y
   ```

2. **Create database and user**:
   ```bash
   sudo -u postgres psql
   ```
   Then in PostgreSQL:
   ```sql
   CREATE DATABASE covenant_noc;
   CREATE USER covenant_user WITH PASSWORD 'your_secure_password_here';
   GRANT ALL PRIVILEGES ON DATABASE covenant_noc TO covenant_user;
   \q
   ```

3. **Update .env file**:
   ```bash
   nano .env
   ```
   Change DATABASE_URL to:
   ```env
   DATABASE_URL="postgresql://covenant_user:your_secure_password_here@localhost:5432/covenant_noc?schema=public"
   ```

4. **Run migrations**:
   ```bash
   npx prisma migrate deploy
   ```

5. **Restart application**:
   ```bash
   pm2 restart covenant-noc
   ```

### Option 2: Use Docker PostgreSQL (Like Development)

1. **Create docker-compose.yml** (if not exists):
   ```bash
   cat > docker-compose.yml << 'EOF'
   version: '3.8'
   services:
     db:
       image: postgres:15-alpine
       container_name: covenant_noc_db
       restart: always
       environment:
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: password
         POSTGRES_DB: covenant_noc
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
   volumes:
     postgres_data:
   EOF
   ```

2. **Start PostgreSQL**:
   ```bash
   docker-compose up -d
   ```

3. **Update .env**:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/covenant_noc?schema=public"
   ```

4. **Run migrations**:
   ```bash
   npx prisma migrate deploy
   ```

5. **Restart application**:
   ```bash
   pm2 restart covenant-noc
   ```

## Verify Polling Interval Fix

After deploying, test the polling interval:

1. Open a site in the dashboard
2. Click on the site to open settings
3. Change "Polling Interval (Seconds)" from 1 to 60
4. Click Save
5. Check PM2 logs to verify:
   ```bash
   pm2 logs covenant-noc --lines 20
   ```
   You should see: `[Site Update] Restarted monitoring for site <id> with interval 60s`

## Troubleshooting

### Polling Interval Still Not Working

1. **Check logs**:
   ```bash
   pm2 logs covenant-noc --lines 50
   ```

2. **Verify site was updated**:
   ```bash
   # Connect to database
   psql $DATABASE_URL
   # Check monitoringInterval
   SELECT id, name, "monitoringInterval" FROM "Site";
   ```

3. **Manually restart monitoring** (if needed):
   ```bash
   pm2 restart covenant-noc
   ```

### Database Connection Still Failing

1. **Test database connection**:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Check PostgreSQL is running**:
   ```bash
   sudo systemctl status postgresql
   # Or for Docker:
   docker ps | grep postgres
   ```

3. **Check .env file**:
   ```bash
   cat .env | grep DATABASE_URL
   ```

4. **Verify firewall** (if PostgreSQL is on different server):
   ```bash
   sudo ufw status
   ```

## What Was Fixed

### Polling Interval Issue
- **Problem**: When updating site settings, monitoring wasn't restarting with the new interval
- **Fix**: 
  - Always stop monitoring first before restarting
  - Properly parse and validate monitoringInterval (minimum 1 second)
  - Use the updated interval value from database
  - Added logging to track interval changes

### Code Changes
- `server/index.js` PUT `/api/sites/:id` route:
  - Always calls `stopMonitoring()` first
  - Properly parses `monitoringInterval` with validation
  - Restarts monitoring with new interval from database
  - Added console logging for debugging

## Next Steps

1. ✅ Deploy the fix to production
2. ✅ Configure local PostgreSQL database
3. ✅ Test polling interval changes
4. ✅ Verify monitoring is working correctly

Your polling interval should now work correctly! 🎉

