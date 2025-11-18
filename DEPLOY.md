# Deployment Guide

This guide covers deploying Covenant NOC to your server.

## Prerequisites

- Node.js 18+ installed on your server
- Git installed
- PostgreSQL database (Neon or self-hosted)
- PM2 (for process management) - `npm install -g pm2`

## Quick Deploy Script

```bash
#!/bin/bash
# deploy.sh - Quick deployment script

# Clone or pull latest code
if [ -d "covenant-noc" ]; then
  cd covenant-noc
  git pull origin main
else
  git clone https://github.com/bingooasis0/covenant-noc.git
  cd covenant-noc
fi

# Install dependencies
npm install

# Build frontend
npm run build

# Copy environment file (if not exists)
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Please edit .env file with your configuration"
  exit 1
fi

# Run database migrations
npx prisma migrate deploy

# Start with PM2
pm2 delete covenant-noc 2>/dev/null || true
pm2 start ecosystem.config.js --name covenant-noc
pm2 save

echo "✅ Deployment complete!"
echo "View logs: pm2 logs covenant-noc"
echo "View status: pm2 status"
```

## Manual Deployment Steps

### 1. Clone Repository

```bash
git clone https://github.com/bingooasis0/covenant-noc.git
cd covenant-noc
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
nano .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Random secret for sessions
- `CLIENT_URL` - Your frontend URL
- `NODE_ENV=production`

### 4. Run Database Migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Build Frontend

```bash
npm run build
```

### 6. Start with PM2

```bash
pm2 start ecosystem.config.js --name covenant-noc
pm2 save
pm2 startup  # Run this once to start PM2 on boot
```

## Updating Deployment

```bash
cd covenant-noc
git pull origin main
npm install
npm run build
npx prisma migrate deploy
pm2 restart covenant-noc
```

## Nginx Configuration

Create `/etc/nginx/sites-available/covenant-noc`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend static files
    location / {
        root /path/to/covenant-noc/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
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

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/covenant-noc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Firewall Setup

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

## Monitoring & Logs

```bash
# PM2 logs
pm2 logs covenant-noc

# PM2 status
pm2 status

# PM2 monitoring
pm2 monit

# Restart application
pm2 restart covenant-noc

# Stop application
pm2 stop covenant-noc
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

### Database Connection Issues

- Verify `DATABASE_URL` in `.env`
- Check database is accessible from server
- Verify firewall allows database connections

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Backup Strategy

### Database Backup

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-YYYYMMDD.sql
```

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL > $BACKUP_DIR/backup-$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup-*.sql" -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

