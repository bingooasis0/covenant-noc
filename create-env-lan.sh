#!/bin/bash
# Create .env file for LAN deployment

set -e

echo "🔧 Creating .env file for LAN deployment..."

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

# Copy template
if [ -f ".env.lan.example" ]; then
    cp .env.lan.example .env
    echo "✅ Created .env from .env.lan.example"
else
    echo "❌ .env.lan.example not found!"
    exit 1
fi

# Get server IP address
echo ""
echo "🌐 Detecting server IP address..."
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ip route get 1.1.1.1 | awk '{print $7; exit}' 2>/dev/null || echo "192.168.1.100")

if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" != "192.168.1.100" ]; then
    echo "📡 Detected server IP: $SERVER_IP"
    read -p "Use this IP for CLIENT_URL? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        # Update CLIENT_URL in .env
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|CLIENT_URL=.*|CLIENT_URL=http://$SERVER_IP:3001|" .env
        else
            # Linux
            sed -i "s|CLIENT_URL=.*|CLIENT_URL=http://$SERVER_IP:3001|" .env
        fi
        echo "✅ Updated CLIENT_URL to http://$SERVER_IP:3001"
    fi
fi

echo ""
echo "📝 Please edit .env and set your DATABASE_URL:"
echo "   nano .env"
echo ""
echo "Required:"
echo "  - DATABASE_URL (PostgreSQL connection string)"
echo ""
echo "Optional:"
echo "  - CLIENT_URL (if you want to change from detected IP)"
echo "  - PORT (default: 3000)"

