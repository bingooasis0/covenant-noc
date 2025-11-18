# 🚀 Production Deployment Guide

## Quick Production Start (Windows)

```cmd
# 1. Run the production start script
start-production.bat
```

Or manually:

```cmd
# Set environment and start
set NODE_ENV=production && node server/index.js
```

## ✅ Pre-Deployment Checklist

- [x] Dependencies installed (`npm install` - completed)
- [x] Session secret configured in `.env`
- [x] Production build created (`npm run build` - completed)
- [x] Security packages installed (helmet, rate-limiting, bcrypt)
- [x] Database schema initialized

## 🔒 Security Configuration

Your deployment includes:

1. **Authentication**: Bcrypt password hashing (12 rounds)
2. **Rate Limiting**:
   - Login: 5 attempts per 15 minutes
   - API: 100 requests per minute
3. **Security Headers**:
   - CSP (Content Security Policy)
   - HSTS (HTTP Strict Transport Security)
   - XSS Protection
4. **Session Security**:
   - HTTP-only cookies
   - Secure flag (in production with HTTPS)
   - 24-hour expiration

## 📋 First-Time Setup

1. **Access the application** at `http://localhost:3000`
2. **Register the first user** (only available when no users exist)
3. **Login** and start monitoring your network

## 🌐 Production Deployment Options

### Option 1: Windows Service (Recommended for Windows Server)

Install as a Windows service using NSSM:

```cmd
# Download NSSM from nssm.cc
nssm install NOCTURNAL "C:\Program Files\nodejs\node.exe" "C:\Users\colby\Desktop\covenant-noc\server\index.js"
nssm set NOCTURNAL AppEnvironmentExtra NODE_ENV=production
nssm start NOCTURNAL
```

### Option 2: PM2 (Cross-platform)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 3: IIS with iisnode (Windows IIS)

1. Install iisnode
2. Create `web.config`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server/index.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server/index.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}"/>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="server/index.js"/>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## 🔐 HTTPS Setup (Required for Production)

### Using Nginx as Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name noc.yourcompany.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
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

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name noc.yourcompany.com;
    return 301 https://$server_name$request_uri;
}
```

### Using Apache as Reverse Proxy

```apache
<VirtualHost *:443>
    ServerName noc.yourcompany.com

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    Header always set Strict-Transport-Security "max-age=31536000"
</VirtualHost>
```

## 🔧 Environment Configuration

Update `.env` for production:

```bash
SESSION_SECRET=5250d41ee4635cd5a393affdd5a1f25240bac7adc5dd78e07ec41288d78dc57e
PORT=3000
DB_PATH=./nocturnal.db
```

**Important**: If using a reverse proxy, update `CLIENT_URL` is not needed as the app serves static files.

## 📊 Monitoring & Logs

### View Logs (PM2)
```bash
pm2 logs NOCTURNAL
pm2 monit
```

### Database Backup
```bash
# Backup the database
copy nocturnal.db nocturnal.db.backup
# Or use SQLite backup command
sqlite3 nocturnal.db ".backup nocturnal.db.backup"
```

## 🔒 Firewall Configuration

### Windows Firewall
```cmd
netsh advfirewall firewall add rule name="NOCTURNAL" dir=in action=allow protocol=TCP localport=3000
```

### Linux iptables
```bash
# Allow port 3000 from specific IP/network only
iptables -A INPUT -p tcp -s 192.168.1.0/24 --dport 3000 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

## 🛡️ Security Hardening

1. **Network Access**: Restrict to NOC network only
2. **Strong Passwords**: Enforce minimum 8 characters (already implemented)
3. **Regular Updates**: Keep Node.js and npm packages updated
4. **Database Backups**: Schedule automated backups
5. **HTTPS Only**: Always use SSL/TLS in production
6. **Audit Logs**: Review audit logs regularly for suspicious activity

## 📈 Performance Tuning

For high-traffic NOCs, consider:

1. **Database**: Switch to PostgreSQL or MySQL for better concurrency
2. **Session Store**: Use Redis for session storage
3. **Load Balancing**: Run multiple instances behind a load balancer
4. **Caching**: Implement Redis caching for metrics data

## ⚠️ Troubleshooting

**Port already in use:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000
# Kill process
taskkill /PID <process_id> /F
```

**Session issues:**
Regenerate session secret and restart server

**Database locked:**
Check for multiple instances running and stop them

## 🔄 Updating

```bash
# Pull latest changes
git pull

# Reinstall dependencies
npm install

# Rebuild frontend
npm run build

# Restart server
pm2 restart NOCTURNAL
# Or restart Windows service
nssm restart NOCTURNAL
```

## 📞 Support

For issues, check:
- Application logs
- Browser console (F12)
- Audit log in the dashboard
- Server error logs

Current Status: ✅ **Ready for Production Deployment**
