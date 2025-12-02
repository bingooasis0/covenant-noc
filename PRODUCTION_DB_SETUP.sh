#!/bin/bash
# Production Database Setup Script for Ubuntu Server

set -e

echo "🚀 Setting up PostgreSQL database for Covenant NOC..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    echo "✅ PostgreSQL installed"
else
    echo "✅ PostgreSQL already installed"
fi

# Check if PostgreSQL is running
if sudo systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL is running"
else
    echo "🔄 Starting PostgreSQL..."
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo "✅ PostgreSQL started and enabled on boot"
fi

# Create database and user
echo "🗄️  Setting up database..."
sudo -u postgres psql << 'EOF'
-- Create database if not exists
SELECT 'CREATE DATABASE covenant_noc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'covenant_noc')\gexec

-- Create user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'covenant_user') THEN
        CREATE USER covenant_user WITH PASSWORD 'covenant_secure_password_change_me';
    END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE covenant_noc TO covenant_user;
ALTER DATABASE covenant_noc OWNER TO covenant_user;
EOF

echo "✅ Database and user created"

# Update .env file
echo "📝 Updating .env file..."
cd ~/covenant-noc

if [ -f .env ]; then
    # Backup existing .env
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up existing .env"
fi

# Update DATABASE_URL in .env
if grep -q "DATABASE_URL=" .env; then
    # Replace existing DATABASE_URL
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://covenant_user:covenant_secure_password_change_me@localhost:5432/covenant_noc?schema=public"|' .env
    echo "✅ Updated DATABASE_URL in .env"
else
    # Add DATABASE_URL if not present
    echo 'DATABASE_URL="postgresql://covenant_user:covenant_secure_password_change_me@localhost:5432/covenant_noc?schema=public"' >> .env
    echo "✅ Added DATABASE_URL to .env"
fi

echo ""
echo "⚠️  IMPORTANT: Change the database password in .env file!"
echo "   Current password: covenant_secure_password_change_me"
echo "   Edit .env and change it to a secure password"
echo "   Then update PostgreSQL user password:"
echo "   sudo -u postgres psql -c \"ALTER USER covenant_user WITH PASSWORD 'your_new_password';\""
echo ""

# Run migrations
echo "🔄 Running database migrations..."
export DATABASE_URL="postgresql://covenant_user:covenant_secure_password_change_me@localhost:5432/covenant_noc?schema=public"
npx prisma migrate deploy

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and change the database password"
echo "2. Update PostgreSQL user password to match"
echo "3. Restart the application: pm2 restart covenant-noc"
echo "4. Check logs: pm2 logs covenant-noc"

