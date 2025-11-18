# NOCTURNAL NOC - Project Structure

## Current Active Files

### Frontend (`src/`)

```
src/
├── main.jsx                      # React app entry point
├── App.jsx                       # Main app component (auth + routing)
└── components/
    ├── Login.jsx                 # Authentication component
    └── NOCDashboardV2.jsx        # Main enterprise NOC dashboard ⭐
```

### Backend (`server/`)

```
server/
├── index.js                      # Express server + API routes
├── db.js                         # SQLite database setup
├── monitoring.js                 # ICMP + SNMP monitoring engine
├── netflow.js                    # NetFlow collector
├── meraki-api.js                 # Meraki API integration
└── noc.db                        # SQLite database (auto-created)
```

### Documentation

```
README.md                         # Main project overview + quick start
DASHBOARD_GUIDE.md                # Comprehensive dashboard user guide ⭐
DEPLOYMENT.md                     # Production deployment instructions
FIREWALL-SETUP.md                 # Firewall configuration guide
```

### Configuration

```
package.json                      # Dependencies + scripts
vite.config.js                    # Vite build configuration
.env.example                      # Environment variable template
.gitignore                        # Git ignore rules
```

### Archive (`archive/`)

```
archive/
├── README.md                     # Archive documentation
├── old-components/               # Previous dashboard versions (7 files)
└── old-docs/                     # Superseded documentation (5 files)
```

## Key Components

### NOCDashboardV2.jsx (Main Dashboard)
The enterprise-grade dashboard supporting:
- **3 View Modes**: Table, Grid, Map
- **4 Monitoring Methods**: ICMP, SNMP, NetFlow, API
- **Advanced Features**: Filtering, grouping, sorting, alerts
- **Performance**: Optimized for 500+ sites
- **Size**: ~2000 lines, fully self-contained

### Backend API Endpoints

**Authentication:**
- `POST /api/auth/register` - First user registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Check auth status

**Sites:**
- `GET /api/sites` - List all sites
- `POST /api/sites` - Create new site
- `PUT /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Delete site

**Monitoring:**
- `GET /api/monitoring/:siteId` - ICMP metrics
- `GET /api/monitoring/:siteId/history` - Historical data
- `GET /api/monitoring/:siteId/snmp` - SNMP metrics
- `GET /api/monitoring/:siteId/netflow` - NetFlow stats
- `GET /api/monitoring/:siteId/meraki` - Meraki API data

**Meraki Actions:**
- `POST /api/meraki/:siteId/reboot` - Reboot device
- `POST /api/meraki/:siteId/blink` - Blink device LEDs

**Utilities:**
- `GET /api/geocode?address=...` - Geocode addresses for map
- `GET /api/presets` - Saved site presets
- `GET /api/audit` - Audit log

## Tech Stack

**Frontend:**
- React 18
- Vite (build tool)
- Lucide React (icons)
- Vanilla CSS-in-JS (no external CSS frameworks)

**Backend:**
- Node.js + Express
- Better-SQLite3 (database)
- net-ping (ICMP)
- net-snmp (SNMP)
- Custom NetFlow collector

**Security:**
- Helmet.js (security headers)
- express-session (SQLite-backed sessions)
- bcryptjs (password hashing)
- express-rate-limit (rate limiting)

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (frontend + backend)
npm run build        # Build for production
npm start            # Run production build
```

## Database Schema

**Tables:**
- `users` - User accounts
- `sites` - Monitored sites with configuration
- `metrics` - ICMP monitoring history
- `snmp_metrics` - SNMP data history
- `netflow_stats` - NetFlow statistics
- `presets` - Saved site configurations
- `audit_log` - Action history
- `sessions` - User sessions

## Monitoring Flow

1. **Server starts** → Loads all sites from database
2. **monitoring.js** → Starts ICMP + SNMP polling for each site
3. **netflow.js** → Listens on UDP port 2055 for NetFlow data
4. **API calls** → Frontend fetches metrics every 5-10s
5. **Dashboard** → Displays real-time status + generates alerts

## Port Usage

- **5173** - Vite dev server (frontend)
- **3000** - Express API server (backend)
- **2055** - NetFlow collector (UDP)

## File Size Stats

```
Total Project Size: ~200 KB
Largest Component: NOCDashboardV2.jsx (~80 KB)
Backend Code: ~50 KB
Database: Variable (grows with metrics)
```

## Browser Requirements

Modern browsers supporting:
- ES6+ JavaScript
- CSS Grid/Flexbox
- Fetch API
- LocalStorage

Tested on: Chrome, Firefox, Edge, Safari

---

**Last Updated:** 2025-10-07
**Version:** 2.0 (Enterprise Redesign)
