#!/bin/bash
# Setup .env file for LAN deployment on the server

set -e

echo "🔧 Setting up .env file for LAN deployment..."

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted. Existing .env file preserved."
        exit 1
    fi
fi

# Generate secure JWT secrets
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Get server IP address
echo "🌐 Detecting server IP address..."
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ip route get 1.1.1.1 | awk '{print $7; exit}' 2>/dev/null || echo "192.168.1.100")

if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" != "192.168.1.100" ]; then
    echo "📡 Detected server IP: $SERVER_IP"
    read -p "Use this IP for CLIENT_URL? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        CLIENT_URL="http://$SERVER_IP:3001"
    else
        CLIENT_URL="http://localhost:3001"
    fi
else
    CLIENT_URL="http://localhost:3001"
    echo "⚠️  Could not detect server IP, using localhost"
    echo "   You can edit .env later to set CLIENT_URL to your server's LAN IP"
fi

# Create .env file
cat > .env << EOF
# ============================================
# Covenant NOC - LAN Configuration
# ============================================

# ============ DATABASE ============
# PostgreSQL connection string (Neon or self-hosted)
# Example Neon: postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
# Example Local: postgresql://user:password@localhost:5432/covenant_noc
DATABASE_URL=postgresql://user:password@localhost:5432/covenant_noc

# ============ JWT SECRETS ============
# These are randomly generated secrets - DO NOT CHANGE after first deployment
# Changing these will invalidate all existing sessions
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# ============ SERVER CONFIGURATION ============
# Server port (default: 3000)
PORT=3000

# Environment mode
NODE_ENV=production

# ============ CORS CONFIGURATION ============
# For LAN access, use your server's IP address
CLIENT_URL=$CLIENT_URL

# ============ OPTIONAL CONFIGURATION ============
# JWT Token Expiry (optional, defaults shown)
# JWT_ACCESS_EXPIRY=15m
# JWT_REFRESH_EXPIRY=7d
EOF

echo ""
echo "✅ Created .env file!"
echo ""
echo "📝 IMPORTANT: Edit .env and set your DATABASE_URL:"
echo "   nano .env"
echo ""
echo "Current configuration:"
echo "  - CLIENT_URL: $CLIENT_URL"
echo "  - PORT: 3000"
echo "  - JWT secrets: Generated"
echo ""
echo "You MUST update:"
echo "  - DATABASE_URL (PostgreSQL connection string)"
echo ""
echo "After updating DATABASE_URL, run: ./deploy.sh"

