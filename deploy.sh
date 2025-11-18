#!/bin/bash
# Quick deployment script for Covenant NOC

set -e

echo "🚀 Starting Covenant NOC deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project directory?"
    exit 1
fi

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main || echo "⚠️  Git pull failed or not a git repo, continuing..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    if [ -f ".env.example" ]; then
        echo "📋 Copying .env.example to .env"
        cp .env.example .env
        echo "⚠️  Please edit .env file with your configuration before continuing"
        exit 1
    else
        echo "❌ No .env.example found. Please create .env file manually."
        exit 1
    fi
fi

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma generate
npx prisma migrate deploy || echo "⚠️  Migration failed, continuing..."

# Restart PM2
echo "🔄 Restarting application..."
if pm2 list | grep -q "covenant-noc"; then
    pm2 restart covenant-noc
else
    pm2 start ecosystem.config.js --name covenant-noc
fi

pm2 save

echo "✅ Deployment complete!"
echo ""
echo "📊 View logs: pm2 logs covenant-noc"
echo "📈 View status: pm2 status"
echo "🔄 Restart: pm2 restart covenant-noc"

