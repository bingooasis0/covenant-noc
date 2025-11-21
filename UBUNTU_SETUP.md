# Ubuntu Server Setup Guide

Quick guide to deploy Covenant NOC on a fresh Ubuntu server.

## Prerequisites

- Fresh Ubuntu 20.04+ server
- SSH access with sudo privileges
- Domain name (optional, for SSL)

## Quick Deployment

### Option 1: Automated Script (Recommended)

```bash
# Download and run the deployment script
curl -fsSL https://raw.githubusercontent.com/bingooasis0/covenant-noc/main/deploy-ubuntu.sh -o deploy-ubuntu.sh
chmod +x deploy-ubuntu.sh
./deploy-ubuntu.sh
```

The script will:
- Update system packages
- Install Node.js 18.x
- Install PM2
- Clone/update the repository
- Install dependencies
- Run database migrations
- Build the frontend
- Start the application with PM2

### Option 2: Manual Deployment

#### 1. Update System

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

#### 2. Install Node.js 18.x

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 3. Install Git and Build Tools

```bash
sudo apt-get install -y git build-essential python3
```

#### 4. Install PM2

```bash
sudo npm install -g pm2
```

#### 5. Clone Repository

```bash
git clone https://github.com/bingooasis0/covenant-noc.git
cd covenant-noc
```

#### 6. Install Dependencies

```bash
npm install
```

#### 7. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your settings
nano .env
```

Required environment variables:
```env
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=your-secret-here
CLIENT_URL=http://your-domain.com
NODE_ENV=production
PORT=3000
```

Generate a secure session secret:
```bash
openssl rand -hex 32
```

#### 8. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

#### 9. Build Frontend

```bash
npm run build
```

#### 10. Start with PM2

```bash
# Start application
pm2 start ecosystem.config.js --name covenant-noc

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions it outputs
```

## Configure Nginx Reverse Proxy

### 1. Install Nginx

```bash
sudo apt-get install -y nginx
```

### 2. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/covenant-noc
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    # For initial setup without SSL, use this:
    location / {
        root /home/your-user/covenant-noc/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Important:** Replace:
- `your-domain.com` with your actual domain
- `/home/your-user/covenant-noc` with your actual path

### 3. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/covenant-noc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Setup SSL with Let's Encrypt (Recommended)

### 1. Install Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 2. Obtain Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### 3. Auto-renewal

Certbot sets up auto-renewal automatically. Test it:

```bash
sudo certbot renew --dry-run
```

## Configure Firewall

```bash
# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Verify Installation

1. **Check PM2 Status:**
   ```bash
   pm2 status
   pm2 logs covenant-noc
   ```

2. **Check Nginx:**
   ```bash
   sudo systemctl status nginx
   ```

3. **Access Application:**
   - Open browser: `http://your-domain.com` or `http://your-server-ip`
   - Register the first user
   - Start adding sites to monitor

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs covenant-noc --lines 100

# Check if port is in use
sudo lsof -i :3000

# Restart application
pm2 restart covenant-noc
```

### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Nginx 502 Bad Gateway

- Check if application is running: `pm2 status`
- Check application logs: `pm2 logs covenant-noc`
- Verify proxy_pass URL matches your application port
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Build Errors

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Updating the Application

```bash
cd covenant-noc
git pull origin main
npm install
npm run build
npx prisma migrate deploy
pm2 restart covenant-noc
```

## Backup Strategy

### Database Backup

```bash
# Create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore backup
psql $DATABASE_URL < backup-YYYYMMDD.sql
```

### Automated Backup Script

Create `/home/your-user/backup-noc.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/your-user/backups"
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL > $BACKUP_DIR/backup-$DATE.sql
find $BACKUP_DIR -name "backup-*.sql" -mtime +7 -delete
```

Make executable and add to crontab:

```bash
chmod +x /home/your-user/backup-noc.sh
crontab -e
# Add: 0 2 * * * /home/your-user/backup-noc.sh
```

## Security Checklist

- [ ] Strong SESSION_SECRET in .env
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Firewall configured (UFW)
- [ ] Database credentials are secure
- [ ] Regular backups configured
- [ ] PM2 auto-restart enabled
- [ ] Nginx security headers configured
- [ ] Regular system updates scheduled

## Support

For issues or questions:
- Check logs: `pm2 logs covenant-noc`
- Review documentation: `README.md` and `DEPLOY.md`
- Check GitHub issues: https://github.com/bingooasis0/covenant-noc/issues

