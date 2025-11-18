# Archive Folder

This folder contains old versions and deprecated files from the NOCTURNAL NOC project.

## Old Components (`old-components/`)

These are previous iterations of the dashboard that have been replaced by **NOCDashboardV2.jsx**:

- **NOCTURNAL.jsx** - Original dashboard version
- **NOCTURNAL-OLD.jsx** - Backup of original dashboard
- **NOCTURNAL-COMPACT.jsx** - Compact variant experiment
- **NOCDashboard.jsx** - Alternative dashboard version
- **CardVariants.jsx** - Design experiment for card styles
- **compact-card.jsx** - Standalone card component test

**All of these have been replaced by:** `src/components/NOCDashboardV2.jsx`

## Old Documentation (`old-docs/`)

Previous documentation files that have been superseded:

- **MONITORING_IMPLEMENTATION.md** - Initial monitoring setup docs
- **REAL_MONITORING_SUMMARY.md** - Summary of monitoring features
- **SETUP_REAL_MONITORING.md** - Setup guide for monitoring
- **FRONTEND_IMPLEMENTATION.md** - Original frontend docs
- **NOC-REDESIGN.md** - Redesign planning document

**Current documentation:**
- `README.md` - Main project documentation
- `DASHBOARD_GUIDE.md` - Comprehensive dashboard user guide
- `DEPLOYMENT.md` - Deployment instructions
- `FIREWALL-SETUP.md` - Firewall configuration guide

## Why These Were Archived

The project underwent a complete redesign to create an enterprise-grade NOC dashboard capable of monitoring hundreds of sites simultaneously. The new **NOCDashboardV2** includes:

- Three view modes (Table, Grid, Map)
- Advanced filtering and grouping
- Four monitoring methods (ICMP, SNMP, NetFlow, API)
- Real-time alerting system
- Performance optimizations for scale
- Professional NOC-optimized UI

The old files are preserved here for reference but are no longer used in the active application.

## Safe to Delete?

These files can be safely deleted if you don't need them for historical reference. The active application does not reference any files in this archive folder.

---

**Date Archived:** 2025-10-07
