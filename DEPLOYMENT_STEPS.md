# Deployment Steps - Graph Fixes & Local DB Setup

## Changes Made

### Graph Rendering Fixes
- ✅ Fixed empty graph issue when history data is missing
- ✅ Fixed single data point issue (AreaChart needs at least 2 points)
- ✅ Increased history fetch from 6 to 24 hours for better graph data
- ✅ Improved error handling for undefined/null history arrays

### Local Database Setup
- ✅ Updated limits.js to skip Neon checks for local databases
- ✅ Updated migration script to use environment variables
- ✅ Added database testing/checking scripts

## Deploy to Production (Ubuntu Server)

### Option 1: Quick Deploy (Recommended)

SSH into your Ubuntu server and run:

```bash
cd covenant-noc
git pull origin main
npm install
npm run build
npx prisma migrate deploy
pm2 restart covenant-noc
```

### Option 2: Use Deployment Script

If you have the `deploy.sh` script on your server:

```bash
cd covenant-noc
./deploy.sh
```

### Option 3: Manual Step-by-Step

1. **SSH into your Ubuntu server**
   ```bash
   ssh user@your-server-ip
   ```

2. **Navigate to project directory**
   ```bash
   cd covenant-noc
   ```

3. **Pull latest changes**
   ```bash
   git pull origin main
   ```

4. **Install dependencies** (if package.json changed)
   ```bash
   npm install
   ```

5. **Build frontend**
   ```bash
   npm run build
   ```

6. **Run database migrations** (if schema changed)
   ```bash
   npx prisma migrate deploy
   ```

7. **Restart application**
   ```bash
   pm2 restart covenant-noc
   ```

8. **Verify deployment**
   ```bash
   pm2 logs covenant-noc --lines 50
   pm2 status
   ```

## Verify Graph Fixes

After deployment, check:
1. ✅ Graphs render on all site cards
2. ✅ Graphs show data even with single data points
3. ✅ Graphs load 24 hours of history data
4. ✅ No console errors related to graphs

## Troubleshooting

### Graphs Still Not Showing

1. **Check browser console** for errors
2. **Check API response**:
   ```bash
   curl http://localhost:3000/api/monitoring/{siteId}/history?hours=24
   ```
3. **Check PM2 logs**:
   ```bash
   pm2 logs covenant-noc --lines 100
   ```

### Database Connection Issues

1. **Verify .env file** has correct DATABASE_URL
2. **Test connection**:
   ```bash
   node scripts/test-db-connection.js
   ```
3. **Check database is running** (if local PostgreSQL)

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

## Rollback (if needed)

If something goes wrong:

```bash
cd covenant-noc
git log --oneline -5  # Find previous commit
git checkout <previous-commit-hash>
npm install
npm run build
pm2 restart covenant-noc
```

## Notes

- The graph fixes are backward compatible
- No database migrations required for graph fixes
- Local database changes only affect development environment
- Production should continue using Neon or your production database

