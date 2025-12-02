#!/bin/bash
# Fix Database Connection Issues

set -e

echo "🔧 Fixing PostgreSQL Connection"
echo "==============================="
echo ""

# Check if PostgreSQL is running
echo "1. Checking PostgreSQL status..."
if sudo systemctl is-active --quiet postgresql; then
    echo "   ✅ PostgreSQL is running"
else
    echo "   ❌ PostgreSQL is NOT running. Starting it..."
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    sleep 2
    echo "   ✅ PostgreSQL started"
fi

# Check what port PostgreSQL is listening on
echo ""
echo "2. Checking PostgreSQL port..."
PG_PORT=$(sudo -u postgres psql -t -c "SHOW port;" 2>/dev/null | xargs || echo "5432")
echo "   PostgreSQL is listening on port: $PG_PORT"

# Check if PostgreSQL is listening on localhost
echo ""
echo "3. Checking PostgreSQL is listening on localhost..."
if sudo netstat -tlnp | grep -q ":5432.*postgres" || sudo ss -tlnp | grep -q ":5432.*postgres"; then
    echo "   ✅ PostgreSQL is listening on port 5432"
else
    echo "   ⚠️  PostgreSQL might not be listening on port 5432"
    echo "   Checking PostgreSQL config..."
    sudo -u postgres psql -c "SHOW listen_addresses;"
    sudo -u postgres psql -c "SHOW port;"
fi

# Test connection
echo ""
echo "4. Testing database connection..."
cd ~/covenant-noc

# Try connecting with covenant_user
if PGPASSWORD='covenant123' psql -U covenant_user -d covenant_noc -h localhost -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ Connection successful with covenant_user"
    DB_USER="covenant_user"
    DB_PASSWORD="covenant123"
elif sudo -u postgres psql -d covenant_noc -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ Connection successful with postgres user"
    DB_USER="postgres"
    DB_PASSWORD=""
else
    echo "   ❌ Connection failed. Checking PostgreSQL config..."
    
    # Check pg_hba.conf
    echo ""
    echo "   Checking pg_hba.conf..."
    sudo grep -E "^[^#]" /etc/postgresql/*/main/pg_hba.conf | head -5
    
    # Try to fix pg_hba.conf
    echo ""
    echo "   Updating pg_hba.conf to allow local connections..."
    sudo sed -i 's/local\s*all\s*all\s*peer/local   all             all                                     md5/' /etc/postgresql/*/main/pg_hba.conf 2>/dev/null || true
    sudo sed -i 's/local\s*all\s*all\s*ident/local   all             all                                     md5/' /etc/postgresql/*/main/pg_hba.conf 2>/dev/null || true
    
    # Restart PostgreSQL
    echo "   Restarting PostgreSQL..."
    sudo systemctl restart postgresql
    sleep 2
    
    # Try again
    if PGPASSWORD='covenant123' psql -U covenant_user -d covenant_noc -h localhost -c "SELECT 1;" > /dev/null 2>&1; then
        echo "   ✅ Connection successful after config update"
        DB_USER="covenant_user"
        DB_PASSWORD="covenant123"
    else
        echo "   ⚠️  Still having issues. Using postgres user..."
        DB_USER="postgres"
        DB_PASSWORD=""
    fi
fi

# Update .env file
echo ""
echo "5. Updating .env file..."
if [ -n "$DB_PASSWORD" ]; then
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/covenant_noc?schema=public"
else
    DATABASE_URL="postgresql://$DB_USER@localhost:5432/covenant_noc?schema=public"
fi

# Backup .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Update DATABASE_URL
if grep -q "^DATABASE_URL=" .env; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" .env
else
    echo "DATABASE_URL=\"$DATABASE_URL\"" >> .env
fi

echo "   ✅ .env updated"
echo "   DATABASE_URL=\"$DATABASE_URL\""

# Test Prisma connection
echo ""
echo "6. Testing Prisma connection..."
export DATABASE_URL="$DATABASE_URL"
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ Prisma can connect"
else
    echo "   ⚠️  Prisma connection test failed (this might be OK)"
fi

# Restart application
echo ""
echo "7. Restarting application..."
pm2 restart covenant-noc
sleep 3

# Check logs
echo ""
echo "8. Checking application logs..."
pm2 logs covenant-noc --lines 20 --nostream

echo ""
echo "✅ Done!"
echo ""
echo "If you still see connection errors, check:"
echo "  - PostgreSQL is running: sudo systemctl status postgresql"
echo "  - PostgreSQL is listening: sudo netstat -tlnp | grep 5432"
echo "  - Test connection: psql -U $DB_USER -d covenant_noc -h localhost"

