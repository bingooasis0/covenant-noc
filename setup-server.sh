#!/bin/bash
# Server setup script for Covenant NOC
# Installs Node.js, npm, PM2, and other dependencies

set -e

echo "🔧 Setting up server for Covenant NOC..."

# Update system
echo "📦 Updating system packages..."
sudo apt update

# Install Node.js 20.x (LTS)
echo "📥 Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Verify installation
echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install PM2 globally
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "✅ PM2 already installed: $(pm2 --version)"
fi

# Install PostgreSQL client (if needed for migrations)
echo "📦 Installing PostgreSQL client..."
sudo apt-get install -y postgresql-client || echo "⚠️  PostgreSQL client installation skipped"

# Install build essentials (needed for native modules)
echo "📦 Installing build essentials..."
sudo apt-get install -y build-essential python3 || echo "⚠️  Build essentials already installed"

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. cd covenant-noc"
echo "2. cp .env.example .env"
echo "3. Edit .env with your DATABASE_URL and other settings"
echo "4. ./deploy.sh"

