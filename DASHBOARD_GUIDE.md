# NOCTURNAL NOC Dashboard V2 - User Guide

## Overview
The new NOCTURNAL NOC Dashboard is a complete redesign built specifically for 24/7 Network Operations Centers monitoring hundreds of sites simultaneously. It provides multiple viewing modes, advanced filtering, real-time monitoring across four methods (ICMP, SNMP, NetFlow, API), and enterprise-grade alerting.

---

## Key Features

### 🎯 **Multi-View Modes**
- **Table View**: Dense, sortable table with all metrics visible
- **Grid View**: Card-based layout for visual overview
- **Map View**: Geographic visualization of all sites

### 🔍 **Advanced Filtering & Search**
- Full-text search across site names, customers, IPs, and locations
- Filter by customer, status, monitoring type, and alert level
- Group sites by customer, status, or location
- Sort by any column (name, customer, status, latency, alerts)

### 📊 **Monitoring Methods**
1. **ICMP** - Ping monitoring with latency and packet loss
2. **SNMP** - CPU, memory, interface statistics
3. **NetFlow** - Network flow analysis and traffic patterns
4. **API** - Meraki API integration for device management

### 🚨 **Intelligent Alerting**
- Real-time alert generation from metrics
- Severity levels: Critical, Warning
- Alert acknowledgment system
- Alert filtering and bulk management

### ⚡ **Performance Optimizations**
- Virtual scrolling for hundreds of sites
- Intelligent data fetching (5s UI refresh, 10s metrics)
- Grouped rendering to reduce DOM operations
- Efficient state management

---

## Dashboard Layout

### Header
- **Site Statistics**: Total sites, online/offline counts
- **Alert Summary**: Critical and warning alert counts
- **User Menu**: Theme toggle, settings, logout

### Toolbar
- **Search Bar**: Search across all site fields
- **View Mode Selector**: Switch between Table, Grid, Map
- **Filters Button**: Toggle advanced filter panel
- **Group By**: Organize sites by customer, status, or location
- **Bulk Actions**: Manage multiple selected sites
- **Add Site**: Create new monitoring targets

---

## Using the Dashboard

### Table View
The table view shows all sites in a dense, sortable format.

**Columns:**
- **Checkbox**: Multi-select sites for bulk actions
- **Status**: Color-coded health indicator
- **Site Name**: Click to view details
- **Customer**: Organization name
- **IP Address**: Primary monitoring IP
- **Location**: Physical address
- **Latency**: Current ICMP ping time
- **Monitoring**: Icons showing enabled monitoring types
- **Alerts**: Count of active alerts
- **Actions**: View details or edit site

**Sorting:**
Click any column header to sort. Click again to reverse sort direction.

**Grouping:**
When grouped, sites are organized into collapsible sections. Click the group header to expand/collapse.

### Grid View
Visual card-based layout showing key metrics at a glance.

Each card displays:
- Site name and customer
- Status indicator
- Primary metrics (latency, uptime)
- Active monitoring methods
- Alert count

Click any card to view full details.

### Map View
Geographic visualization of all sites (requires latitude/longitude).

- Sites plotted on interactive map
- Color-coded by status
- Click markers for site info
- Zoom and pan to explore

---

## Filtering & Searching

### Quick Search
Type in the search bar to filter sites by:
- Site name
- Customer name
- IP address
- Location

### Advanced Filters
Click the **Filters** button to access:

**Customer Filter**: Show only sites for specific customers
**Status Filter**: Filter by Operational, Degraded, or Critical
**Monitoring Type**: Show sites with specific monitoring enabled
**Alert Filter**: Show only sites with Critical, Warning, or No alerts

**Clear All**: Reset all filters to defaults

### Grouping
Use the **Group By** dropdown to organize sites:
- **No Grouping**: Flat list of all sites
- **Group by Customer**: Organize by customer name
- **Group by Status**: Separate Online/Offline
- **Group by Location**: Group geographically

---

## Site Details

Click any site to open the detailed view modal with tabs:

### Overview Tab
- Complete site information
- Real-time status
- Monitoring configuration
- Active alerts

### ICMP Tab (if enabled)
- Latency graph (last 24 hours)
- Current latency and jitter
- Packet loss percentage
- Reachability status

### SNMP Tab (if enabled)
- CPU usage
- Memory usage
- System uptime
- Interface statistics
- Traffic graphs per interface

### NetFlow Tab (if enabled)
- Top talkers
- Protocol distribution
- Traffic volume charts
- Flow statistics

### API Tab (if enabled - Meraki)
- Device status
- Client counts
- Configuration sync
- Remote actions (reboot, blink LEDs)

### Alerts Tab
- All active alerts for this site
- Alert severity and time
- Acknowledge button
- Alert history

---

## Adding Sites

Click **Add Site** in the toolbar to create a new monitoring target.

**Required Fields:**
- **Customer**: Organization name
- **Site Name**: Descriptive name
- **IP Address**: Primary IP to monitor
- **Devices**: Number of devices at site
- **Status**: Operational/Degraded/Critical
- **ISP**: Internet service provider
- **Device**: Router/Switch/Firewall/Server/etc.

**Optional Fields:**
- **Failover IP**: Secondary IP for failover monitoring
- **Location**: Physical address (enables geocoding and map view)

**Monitoring Configuration:**
- **Enable ICMP**: Basic ping monitoring (always recommended)
- **Enable SNMP**: Device metrics (requires SNMP community string)
- **Enable NetFlow**: Flow collection (requires NetFlow export configured on device)
- **Enable API**: Meraki dashboard API (requires API key)

Click **Save** to create the site. Monitoring starts immediately.

---

## Editing Sites

From Table View:
- Click the edit icon (pencil) in the Actions column

From Grid/Map View:
- Click the site to open details, then click **Edit Site**

Update any fields and click **Save**. Monitoring restarts with new configuration.

---

## Bulk Actions

Select multiple sites using checkboxes, then click **Actions**:

- **Delete Selected**: Remove multiple sites (with confirmation)
- More bulk actions coming soon (bulk edit, export, etc.)

---

## Alerts & Notifications

### Alert Types
**Critical Alerts** (Red):
- Site unreachable
- Complete service outage

**Warning Alerts** (Yellow):
- High latency (>200ms)
- High packet loss (>5%)
- High CPU usage (>90%)
- High memory usage (>90%)

### Acknowledging Alerts
Click the alert in the site details to acknowledge it. Acknowledged alerts are hidden from the main view but remain in history.

---

## Theme

Toggle between light and dark themes using the sun/moon icon in the header.

Theme preference is saved locally and persists across sessions.

**Dark Theme**: Optimized for 24/7 NOC environments with reduced eye strain
**Light Theme**: Standard bright interface for daytime use

---

## Keyboard Shortcuts

Coming soon! We're adding keyboard shortcuts for:
- Quick search
- View mode switching
- Bulk selection
- Navigation

---

## Best Practices

### For Large Deployments (100+ sites)

1. **Use Grouping**: Organize sites by customer or status for easier management
2. **Apply Filters**: Focus on specific customers or alert states
3. **Table View**: Most efficient for dense information display
4. **Monitor Dashboard Stats**: Keep an eye on the header statistics for quick health overview

### For 24/7 NOC Operations

1. **Enable Dark Theme**: Reduce eye strain during night shifts
2. **Watch Alert Counts**: Red/yellow badges in header show active issues
3. **Sort by Alerts**: Quickly identify problem sites
4. **Acknowledge Alerts**: Keep the view clean by acknowledging resolved issues

### For Multi-Customer MSPs

1. **Group by Customer**: Separate customer environments
2. **Use Customer Filter**: Focus on one customer at a time
3. **Descriptive Naming**: Use consistent naming conventions
4. **Location Data**: Add addresses for geographic insights

---

## Monitoring Methods Explained

### ICMP (Internet Control Message Protocol)
- Basic reachability testing
- Measures latency (round-trip time)
- Detects packet loss
- Minimal overhead
- Works on any IP-enabled device
- **Recommended**: Enable for all sites

### SNMP (Simple Network Management Protocol)
- Deep device metrics
- CPU, memory, interface stats
- Requires SNMP community string configured on device
- More overhead than ICMP
- Best for routers, switches, firewalls
- **Community String**: Usually "public" (read-only) or custom

### NetFlow
- Network traffic analysis
- Top talkers and protocols
- Requires NetFlow export enabled on device (Cisco, Juniper, etc.)
- Default collector port: 2055
- Configure on device: `ip flow-export destination <server-ip> 2055`
- **Heavy traffic**: Only enable for key sites

### API (Meraki Dashboard API)
- Cloud-managed Meraki devices
- Rich device and client data
- Remote management capabilities
- Requires API key from Meraki dashboard
- **Generate Key**: Meraki Dashboard → Organization → Settings → API

---

## Troubleshooting

### Site Shows as Offline But It's Online
- Check firewall rules allow ICMP
- Verify IP address is correct
- Check network path between NOC server and site

### SNMP Not Collecting Data
- Verify SNMP community string matches device config
- Check SNMP is enabled on device
- Verify firewall allows UDP port 161
- Test with: `snmpwalk -v2c -c <community> <ip> system`

### NetFlow Not Showing Data
- Verify NetFlow export is configured on device
- Check firewall allows UDP port 2055
- Confirm device is actually generating flows
- Allow 5-10 minutes for first data

### API Not Working (Meraki)
- Verify API key is valid
- Check API access is enabled in Meraki dashboard
- Ensure device IP matches Meraki device IP
- Review server logs for API errors

### Map Not Showing Sites
- Add location data to sites
- Click site → Edit → Location field
- Use full address format: "123 Main St, City, State ZIP"
- Dashboard automatically geocodes addresses

---

## Performance Tips

### For 500+ Sites
- Use filters to work with subsets
- Group by customer to reduce visible rows
- Consider multiple dashboard instances for different regions
- Enable only necessary monitoring methods per site

### For Slow Networks
- Increase refresh intervals in code
- Reduce history retention
- Disable heavy monitoring (NetFlow) for non-critical sites

---

## Security Notes

- All monitoring runs server-side
- No direct client-to-site connections
- API keys stored encrypted in database
- Session-based authentication
- Rate limiting on all API endpoints
- HTTPS strongly recommended for production

---

## Support & Feedback

For issues, feature requests, or questions:
- Check server logs: `npm run dev` output
- Review browser console for client errors
- Verify database integrity
- Test individual sites using CLI tools

---

## What's Next?

Planned features:
- Configurable alert thresholds
- Email/SMS notifications
- SLA reporting
- Maintenance windows
- Historical reporting
- Multi-user with RBAC
- Webhook integrations
- Mobile-responsive design
- Keyboard shortcuts
- Export functionality (CSV, PDF)

---

## Technical Details

**Frontend**: React + Lucide Icons
**Backend**: Express + Better-SQLite3
**Monitoring**: Native ping, net-snmp, NetFlow collector
**Updates**: 5s UI refresh, 10s metric collection
**Scaling**: Tested with 500+ sites
**Browser**: Modern browsers (Chrome, Firefox, Edge, Safari)

---

Built with ❤️ for Network Operations Teams
