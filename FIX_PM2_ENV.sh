#!/bin/bash
# Fix PM2 Environment Variables

set -e

echo "🔧 Fixing PM2 Environment Variables"
echo "===================================="
echo ""

cd ~/covenant-noc

# Check current .env
echo "1. Checking .env file..."
if [ -f .env ]; then
    echo "   ✅ .env file exists"
    echo "   DATABASE_URL from .env:"
    grep "^DATABASE_URL=" .env || echo "   ⚠️  DATABASE_URL not found in .env"
else
    echo "   ❌ .env file not found!"
    exit 1
fi

# Stop PM2 process
echo ""
echo "2. Stopping PM2 process..."
pm2 stop covenant-noc || true
pm2 delete covenant-noc || true

# Check ecosystem.config.js
echo ""
echo "3. Checking ecosystem.config.js..."
if [ -f ecosystem.config.js ]; then
    echo "   ✅ ecosystem.config.js exists"
    # Check if it has env_file or env
    if grep -q "env_file\|\.env" ecosystem.config.js; then
        echo "   ✅ Config references .env"
    else
        echo "   ⚠️  Config doesn't reference .env, updating..."
        # Backup
        cp ecosystem.config.js ecosystem.config.js.backup
        
        # Update to load .env
        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'covenant-noc',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF
        echo "   ✅ Updated ecosystem.config.js"
    fi
else
    echo "   ⚠️  ecosystem.config.js not found, creating..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'covenant-noc',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF
    echo "   ✅ Created ecosystem.config.js"
fi

# Regenerate Prisma client
echo ""
echo "4. Regenerating Prisma client..."
export $(grep -v '^#' .env | xargs)
npx prisma generate

# Start PM2 with new config
echo ""
echo "5. Starting PM2 with updated config..."
pm2 start ecosystem.config.js
pm2 save

# Wait a moment
sleep 3

# Check logs
echo ""
echo "6. Checking application logs..."
pm2 logs covenant-noc --lines 30 --nostream

echo ""
echo "✅ Done!"
echo ""
echo "If you still see connection errors, try:"
echo "  - Check .env: cat .env | grep DATABASE_URL"
echo "  - Test connection: PGPASSWORD='covenant123' psql -U covenant_user -d covenant_noc -h localhost -c 'SELECT 1;'"
echo "  - Check PM2 env: pm2 env 0"

