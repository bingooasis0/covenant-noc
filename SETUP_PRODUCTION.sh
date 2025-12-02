#!/bin/bash
# Complete Production Setup Script
# Run this once to set up everything

set -e

echo ""
echo "🚀 Covenant NOC - Production Setup"
echo "==================================="
echo ""

cd ~/covenant-noc

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Create admin user
echo ""
echo "👤 Creating admin user..."
node scripts/create-admin.js

# Restart PM2
echo ""
echo "🔄 Restarting application..."
pm2 restart covenant-noc 2>/dev/null || pm2 start ecosystem.config.js
pm2 save

# Show status
echo ""
echo "📊 Application Status:"
pm2 status

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Login at: http://10.1.0.10:3000"
echo "   Email:    colby@covenanttechnology.net"
echo "   Password: admin123"
echo ""
echo "⚠️  Change your password after logging in!"
echo ""

