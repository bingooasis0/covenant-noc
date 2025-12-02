# Simple PostgreSQL Password Reset

## Quick Fix - Run This on Your Server

Copy and paste this entire block:

```bash
cd ~/covenant-noc

# Reset PostgreSQL user and create database
sudo -u postgres psql << 'EOF'
-- Drop and recreate user
DROP USER IF EXISTS covenant_user;
CREATE USER covenant_user WITH PASSWORD 'covenant123';
ALTER USER covenant_user CREATEDB;

-- Drop and recreate database
DROP DATABASE IF EXISTS covenant_noc;
CREATE DATABASE covenant_noc;
GRANT ALL PRIVILEGES ON DATABASE covenant_noc TO covenant_user;
ALTER DATABASE covenant_noc OWNER TO covenant_user;
\q
EOF

# Update .env file
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://covenant_user:covenant123@localhost:5432/covenant_noc?schema=public"
CLIENT_URL=http://10.1.0.10
JWT_ACCESS_SECRET=5ce5cf9b6daff0d6490184e9458d3daed8a47f2cf159b740a0448b12a6d1b46c
JWT_REFRESH_SECRET=4973a730a3053dd2e362b896dbaeebe29d6797bc76ae537393c06f68a4b6f477
SESSION_SECRET=c3df9459dc1292fa478a315f8ab4fb9f921e4a72f87ea85c02101b308b6c4195
ENVEOF

# Run migrations
npx prisma migrate deploy

# Restart app
pm2 restart covenant-noc

# Check logs
pm2 logs covenant-noc --lines 30
```

## Or Use the Automated Script

```bash
cd ~/covenant-noc
git pull origin main
chmod +x RESET_POSTGRES_PASSWORD.sh
./RESET_POSTGRES_PASSWORD.sh
```

## What This Does

1. ✅ Creates new user `covenant_user` with password `covenant123`
2. ✅ Creates database `covenant_noc`
3. ✅ Grants all privileges
4. ✅ Updates `.env` file with correct credentials
5. ✅ Runs database migrations
6. ✅ Restarts the application

## After Running

The credentials will be:
- **User**: `covenant_user`
- **Password**: `covenant123`
- **Database**: `covenant_noc`

**⚠️ Change the password later if needed!**

