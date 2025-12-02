# Quick Production Database Setup

Your PostgreSQL database isn't running. Run these commands on your Ubuntu server:

## Option 1: Install PostgreSQL Directly (Recommended for Production)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE DATABASE covenant_noc;
CREATE USER covenant_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE covenant_noc TO covenant_user;
ALTER DATABASE covenant_noc OWNER TO covenant_user;
\q
EOF

# Update .env file (you already did this, but verify)
cd ~/covenant-noc
nano .env
# Make sure DATABASE_URL is:
# DATABASE_URL="postgresql://covenant_user:your_secure_password_here@localhost:5432/covenant_noc?schema=public"

# Run migrations
npx prisma migrate deploy

# Restart application
pm2 restart covenant-noc

# Check logs
pm2 logs covenant-noc --lines 30
```

## Option 2: Use Docker (If you prefer)

```bash
# Install Docker Compose
sudo apt install -y docker-compose

# Start PostgreSQL container
cd ~/covenant-noc
docker-compose up -d db

# Wait a few seconds for PostgreSQL to start
sleep 5

# Run migrations
npx prisma migrate deploy

# Restart application
pm2 restart covenant-noc
```

## Quick One-Liner (Option 1 - Direct Install)

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib && sudo systemctl start postgresql && sudo systemctl enable postgresql && sudo -u postgres psql -c "CREATE DATABASE covenant_noc;" -c "CREATE USER covenant_user WITH PASSWORD 'covenant123';" -c "GRANT ALL PRIVILEGES ON DATABASE covenant_noc TO covenant_user;" && cd ~/covenant-noc && npx prisma migrate deploy && pm2 restart covenant-noc
```

**⚠️ Change the password `covenant123` to something secure!**

## Verify It's Working

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
psql -U covenant_user -d covenant_noc -h localhost -c "SELECT 1;"

# Check PM2 logs
pm2 logs covenant-noc --lines 50
```

You should see the application connecting to the database successfully!

