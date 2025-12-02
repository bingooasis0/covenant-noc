#!/bin/bash
# Reset PostgreSQL Password and Setup Database

set -e

echo "🔐 PostgreSQL Password Reset & Database Setup"
echo "=============================================="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Installing..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    echo "✅ PostgreSQL installed"
fi

# Start PostgreSQL if not running
if ! sudo systemctl is-active --quiet postgresql; then
    echo "🔄 Starting PostgreSQL..."
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo "✅ PostgreSQL started"
fi

echo ""
echo "Choose an option:"
echo "1. Create new user 'covenant_user' with password 'covenant123' (recommended)"
echo "2. Reset existing 'covenant_user' password"
echo "3. Use default 'postgres' user (no password)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📝 Creating new user 'covenant_user'..."
        sudo -u postgres psql << 'EOF'
-- Drop user if exists and recreate
DROP USER IF EXISTS covenant_user;
CREATE USER covenant_user WITH PASSWORD 'covenant123';
ALTER USER covenant_user CREATEDB;
EOF
        DB_USER="covenant_user"
        DB_PASSWORD="covenant123"
        ;;
    2)
        echo ""
        read -sp "Enter new password for covenant_user: " new_password
        echo ""
        sudo -u postgres psql << EOF
ALTER USER covenant_user WITH PASSWORD '$new_password';
EOF
        DB_USER="covenant_user"
        DB_PASSWORD="$new_password"
        ;;
    3)
        echo ""
        echo "⚠️  Using default postgres user (no password)"
        DB_USER="postgres"
        DB_PASSWORD=""
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "🗄️  Setting up database..."

# Create database
sudo -u postgres psql << EOF
-- Drop database if exists and recreate
DROP DATABASE IF EXISTS covenant_noc;
CREATE DATABASE covenant_noc;
EOF

# Grant privileges
if [ "$DB_USER" != "postgres" ]; then
    sudo -u postgres psql << EOF
GRANT ALL PRIVILEGES ON DATABASE covenant_noc TO $DB_USER;
ALTER DATABASE covenant_noc OWNER TO $DB_USER;
EOF
fi

echo "✅ Database created"

# Update .env file
echo ""
echo "📝 Updating .env file..."
cd ~/covenant-noc

if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from env.example..."
    if [ -f env.example ]; then
        cp env.example .env
    else
        echo "❌ env.example not found. Creating basic .env..."
        cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://$DB_USER:${DB_PASSWORD}@localhost:5432/covenant_noc?schema=public"
CLIENT_URL=http://10.1.0.10
EOF
    fi
fi

# Update DATABASE_URL in .env
if [ -n "$DB_PASSWORD" ]; then
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/covenant_noc?schema=public"
else
    DATABASE_URL="postgresql://$DB_USER@localhost:5432/covenant_noc?schema=public"
fi

# Backup .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update DATABASE_URL
if grep -q "^DATABASE_URL=" .env; then
    # Replace existing
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" .env
    else
        # Linux
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" .env
    fi
else
    # Add if not present
    echo "DATABASE_URL=\"$DATABASE_URL\"" >> .env
fi

echo "✅ .env updated"
echo ""
echo "📋 Database credentials:"
echo "   User: $DB_USER"
if [ -n "$DB_PASSWORD" ]; then
    echo "   Password: $DB_PASSWORD"
else
    echo "   Password: (none)"
fi
echo "   Database: covenant_noc"
echo "   Connection: $DATABASE_URL"
echo ""

# Test connection
echo "🔌 Testing database connection..."
if [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
    psql -U "$DB_USER" -d covenant_noc -h localhost -c "SELECT 1;" > /dev/null 2>&1
else
    sudo -u postgres psql -d covenant_noc -c "SELECT 1;" > /dev/null 2>&1
fi

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "⚠️  Could not test connection (this is OK if migrations haven't run yet)"
fi

# Run migrations
echo ""
echo "🔄 Running database migrations..."
export DATABASE_URL="$DATABASE_URL"
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully!"
else
    echo "❌ Migration failed. Check the error above."
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Summary:"
echo "   Database User: $DB_USER"
if [ -n "$DB_PASSWORD" ]; then
    echo "   Password: $DB_PASSWORD"
fi
echo "   Database: covenant_noc"
echo "   .env file: ~/covenant-noc/.env"
echo ""
echo "🔄 Restarting application..."
pm2 restart covenant-noc

echo ""
echo "✅ Done! Check logs with: pm2 logs covenant-noc"

