#!/bin/bash
# Ubuntu Deployment Script for Covenant NOC
# Run this script on a fresh Ubuntu server

set -e  # Exit on error

echo "🚀 Starting Covenant NOC Deployment on Ubuntu..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root. Use a regular user with sudo privileges.${NC}"
   exit 1
fi

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18.x
echo -e "${YELLOW}📦 Installing Node.js 18.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Install Git if not present
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Git...${NC}"
    sudo apt-get install -y git
fi

# Install PM2 globally
echo -e "${YELLOW}📦 Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "PM2 already installed"
fi

# Install build essentials (needed for native modules)
echo -e "${YELLOW}📦 Installing build essentials...${NC}"
sudo apt-get install -y build-essential python3

# Install PostgreSQL client (if using Neon, this is optional)
echo -e "${YELLOW}📦 Installing PostgreSQL client...${NC}"
sudo apt-get install -y postgresql-client

# Clone or update repository
REPO_DIR="covenant-noc"
if [ -d "$REPO_DIR" ]; then
    echo -e "${YELLOW}📦 Updating existing repository...${NC}"
    cd $REPO_DIR
    git pull origin main
else
    echo -e "${YELLOW}📦 Cloning repository...${NC}"
    echo "Enter your GitHub repository URL (or press Enter for default):"
    read -r REPO_URL
    if [ -z "$REPO_URL" ]; then
        REPO_URL="https://github.com/bingooasis0/covenant-noc.git"
    fi
    git clone $REPO_URL $REPO_DIR
    cd $REPO_DIR
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing npm dependencies...${NC}"
npm install

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${RED}⚠️  Please edit .env file with your configuration before continuing!${NC}"
        echo "Required variables:"
        echo "  - DATABASE_URL (PostgreSQL connection string)"
        echo "  - SESSION_SECRET (generate with: openssl rand -hex 32)"
        echo "  - CLIENT_URL (your frontend URL)"
        echo "  - NODE_ENV=production"
        echo ""
        echo "Press Enter after editing .env file..."
        read
    else
        echo -e "${RED}❌ .env.example not found. Please create .env manually.${NC}"
        exit 1
    fi
fi

# Generate Prisma client
echo -e "${YELLOW}📦 Generating Prisma client...${NC}"
npx prisma generate

# Run database migrations
echo -e "${YELLOW}📦 Running database migrations...${NC}"
npx prisma migrate deploy

# Build frontend
echo -e "${YELLOW}📦 Building frontend...${NC}"
npm run build

# Create logs directory
mkdir -p logs

# Stop existing PM2 process if running
echo -e "${YELLOW}📦 Managing PM2 process...${NC}"
pm2 delete covenant-noc 2>/dev/null || true

# Start with PM2
echo -e "${YELLOW}📦 Starting application with PM2...${NC}"
pm2 start ecosystem.config.js --name covenant-noc
pm2 save

# Setup PM2 startup script
echo -e "${YELLOW}📦 Setting up PM2 startup...${NC}"
pm2 startup | grep -v "PM2" | bash || echo "PM2 startup already configured"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Application Status:"
pm2 status
echo ""
echo "Useful commands:"
echo "  - View logs: pm2 logs covenant-noc"
echo "  - Restart: pm2 restart covenant-noc"
echo "  - Stop: pm2 stop covenant-noc"
echo "  - Monitor: pm2 monit"
echo ""
echo "Next steps:"
echo "  1. Configure Nginx reverse proxy (see DEPLOY.md)"
echo "  2. Setup SSL certificates (Let's Encrypt recommended)"
echo "  3. Configure firewall (ufw allow 80/tcp && ufw allow 443/tcp)"
echo ""

