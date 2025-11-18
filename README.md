# NOCTURNAL - Enterprise Network Operations Center

Enterprise-grade NOC monitoring dashboard designed for 24/7 operations centers managing hundreds of sites with real-time monitoring across ICMP, SNMP, NetFlow, and API integrations.

## 🔒 Security Features

- **User Authentication**: Secure login system with bcrypt password hashing
- **Session Management**: HTTP-only cookies with CSRF protection
- **Rate Limiting**: Protects against brute force attacks (5 login attempts per 15 minutes)
- **Security Headers**: Helmet.js for comprehensive security headers (CSP, HSTS, etc.)
- **Database Security**: SQLite with parameterized queries to prevent SQL injection
- **HTTPS Ready**: Configured for secure production deployment

## 📋 Prerequisites

- Node.js 18+
- npm or yarn

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Generate a secure session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env and add your generated session secret
```

### 3. Development Mode

```bash
# Start both frontend and backend in development
npm run dev

# Or run them separately:
npm run server  # Backend on port 3000
npm run client  # Frontend on port 5173
```

### 4. Production Deployment

```bash
# Build the frontend
npm run build

# Set environment to production
export NODE_ENV=production

# Start the server
npm start
```

## 🔐 First Time Setup

1. **Access the application** at `http://localhost:3000` (production) or `http://localhost:5173` (development)
2. **Register the first user** - Registration is only available when no users exist
3. **Login** with your credentials
4. **Start adding sites** to monitor

## 📁 Project Structure

```
covenant-noc/
├── server/
│   ├── index.js           # Express server with auth & API routes
│   ├── db.js              # SQLite database setup
│   ├── monitoring.js      # ICMP + SNMP monitoring engine
│   ├── netflow.js         # NetFlow collector
│   └── meraki-api.js      # Meraki API integration
├── src/
│   ├── components/
│   │   ├── Login.jsx      # Authentication component
│   │   └── NOCDashboardV2.jsx  # Enterprise NOC dashboard
│   ├── App.jsx            # Root component with auth logic
│   └── main.jsx           # React entry point
├── archive/               # Old versions (not used)
├── .env.example           # Environment variables template
├── vite.config.js         # Vite configuration
├── README.md              # This file
├── DASHBOARD_GUIDE.md     # Comprehensive dashboard user guide
├── DEPLOYMENT.md          # Production deployment guide
└── PROJECT_STRUCTURE.md   # Detailed file structure documentation
```

For complete file structure details, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

## 🛡️ Production Deployment with PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## 🌐 Nginx Reverse Proxy (Recommended for Production)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

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
```

## 📊 Features

### Dashboard & Visualization
- **3 View Modes**: Table (dense data), Grid (visual cards), Map (geographic)
- **Advanced Filtering**: Search, filter by customer/status/type/alerts, multi-column sorting
- **Smart Grouping**: Organize by customer, status, or location with collapsible groups
- **Real-time Updates**: 5-second UI refresh, 10-second metric polling
- **Dark/Light Themes**: NOC-optimized color schemes with persistent preference

### Monitoring Capabilities
- **ICMP Monitoring**: Ping latency, packet loss, jitter, reachability
- **SNMP Monitoring**: CPU, memory, uptime, interface statistics
- **NetFlow Analysis**: Traffic flows, top talkers, protocol distribution
- **API Integration**: Meraki dashboard API with remote management

### Alerting & Management
- **Intelligent Alerts**: Auto-generated from metrics with severity levels
- **Alert Acknowledgment**: Track and dismiss alerts
- **Bulk Operations**: Multi-select sites for mass actions
- **Site Details**: Deep-dive modals with tabbed interface
- **Audit Logging**: Complete history of all system changes

### Enterprise Features
- **Multi-Customer Support**: Perfect for MSPs managing multiple clients
- **Scalability**: Optimized for 500+ sites with virtual scrolling
- **Geocoding**: Automatic address-to-coordinates for map view
- **Session Management**: Secure, persistent user sessions
- **Rate Limiting**: Protection against abuse

For detailed feature documentation, see [DASHBOARD_GUIDE.md](DASHBOARD_GUIDE.md).

## 🔑 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SESSION_SECRET` | Session encryption key | auto-generated | Yes (production) |
| `NODE_ENV` | Environment mode | development | No |
| `PORT` | Server port | 3000 | No |
| `DB_PATH` | SQLite database path | ./nocturnal.db | No |
| `CLIENT_URL` | Frontend URL for CORS | http://localhost:5173 | No |

## 🔒 Security Best Practices

1. **Always use HTTPS in production** - Use a reverse proxy like Nginx with SSL certificates
2. **Strong session secret** - Generate a cryptographically secure random string
3. **Regular backups** - Backup the SQLite database regularly
4. **Firewall rules** - Restrict access to trusted networks only
5. **Update dependencies** - Keep packages up to date for security patches
6. **User passwords** - Enforce minimum 8 character passwords

## 📈 API Endpoints

### Authentication
- `POST /api/auth/register` - Register first user (disabled after first user)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Check authentication status

### Sites
- `GET /api/sites` - List all sites
- `POST /api/sites` - Create new site
- `PUT /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Delete specific site
- `DELETE /api/sites` - Delete all sites

### Monitoring
- `GET /api/monitoring/:siteId` - Get ICMP metrics
- `GET /api/monitoring/:siteId/history` - Get historical ICMP data
- `GET /api/monitoring/:siteId/snmp` - Get SNMP metrics
- `GET /api/monitoring/:siteId/netflow` - Get NetFlow statistics
- `GET /api/monitoring/:siteId/meraki` - Get Meraki API data

### Meraki Actions
- `POST /api/meraki/:siteId/reboot` - Reboot Meraki device
- `POST /api/meraki/:siteId/blink` - Blink device LEDs

### Utilities
- `GET /api/geocode?address=...` - Geocode address for map
- `GET /api/presets` - List saved presets
- `POST /api/presets` - Create new preset
- `PUT /api/presets/:id` - Update preset
- `DELETE /api/presets/:id` - Delete preset
- `GET /api/audit` - Get audit log
- `POST /api/audit` - Create audit entry

For complete API documentation, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Change port in .env file
PORT=3001
```

**Database locked error:**
```bash
# Stop all instances and restart
pm2 delete all
pm2 start ecosystem.config.js
```

**Session issues:**
```bash
# Clear sessions by regenerating session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Update .env with new secret and restart
```

## 📝 License

Private - For NOC Use Only
