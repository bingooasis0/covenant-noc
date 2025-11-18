# Monitoring Setup Guide

All four monitoring methods are fully implemented and working. Here's how to enable each one:

---

## ✅ ICMP Monitoring (Already Working!)

**Status:** ✅ Active - I can see it working in your logs

**What it monitors:**
- Latency (ping time)
- Packet loss
- Site reachability (up/down)

**How to enable:**
- Automatically enabled when you add a site with "Enable ICMP Monitoring" checked
- No device configuration needed
- Works for any IP that responds to ping

**Current output from your logs:**
```
[Monitor] Site 8 (96.74.40.161): operational - 69.000ms, 0.000% loss
[Monitor] Site 7 (71.228.198.36): operational - 73.000ms, 0.000% loss
```

---

## 📊 SNMP Monitoring

**Status:** ⚠️ Requires device configuration

**What it monitors:**
- CPU usage %
- Memory usage %
- System uptime
- Network interface statistics (traffic in/out, status)

**Device requirements:**
- SNMP must be enabled on the target device
- SNMP community string configured (default: "public")
- UDP port 161 must be accessible from NOC server

### How to enable SNMP on devices:

#### **Cisco IOS Router/Switch:**
```
configure terminal
snmp-server community public RO
snmp-server location "Your Location"
snmp-server contact "admin@example.com"
end
write memory
```

#### **Ubiquiti EdgeRouter:**
```
configure
set service snmp community public authorization ro
commit
save
```

#### **pfSense Firewall:**
1. Go to Services → SNMP
2. Enable SNMP Daemon
3. Community String: `public`
4. Click Save

#### **MikroTik:**
```
/snmp set enabled=yes
/snmp community add name=public addresses=0.0.0.0/0
```

#### **Meraki (via dashboard):**
1. Network-wide → General
2. Enable SNMP
3. Community string: `public`
4. Access: v2c

### Test SNMP is working:
```bash
# Install snmpwalk (if not installed)
npm install -g snmpwalk

# Test from NOC server
snmpwalk -v2c -c public <device-ip> system
```

### Add site with SNMP in dashboard:
1. Click "Add Site"
2. Fill in basic info
3. Check "Enable SNMP Monitoring"
4. SNMP Community: `public` (or your custom string)
5. Save

---

## 🌊 NetFlow Monitoring

**Status:** ⚠️ Requires device export configuration

**What it monitors:**
- Network traffic flows (source → destination)
- Top talkers (who's using bandwidth)
- Protocol distribution (HTTP, DNS, etc.)
- Flow statistics

**Device requirements:**
- NetFlow export capability (Cisco, Ubiquiti, pfSense, etc.)
- Device configured to export to NOC server IP on port 2055
- UDP port 2055 accessible

### How to enable NetFlow export:

#### **Cisco IOS Router:**
```
configure terminal
ip flow-export version 5
ip flow-export destination <NOC-SERVER-IP> 2055
!
interface GigabitEthernet0/0
 ip flow ingress
 ip flow egress
!
end
write memory
```

#### **Ubiquiti EdgeRouter:**
```
configure
set system flow-accounting interface eth0
set system flow-accounting netflow server <NOC-SERVER-IP> port 2055
set system flow-accounting netflow version 5
commit
save
```

#### **pfSense:**
1. Install **softflowd** package
2. System → Package Manager → Available Packages
3. Search "softflowd" and install
4. Services → softflowd
5. Interface: LAN
6. Host: `<NOC-SERVER-IP>`
7. Port: `2055`
8. Version: `5`

#### **MikroTik:**
```
/ip traffic-flow
set enabled=yes interfaces=ether1
/ip traffic-flow target
add dst-address=<NOC-SERVER-IP>:2055 version=5
```

### Test NetFlow is being received:
```bash
# Check server logs
# You should see: [NetFlow] Received flow data

# Or check with tcpdump
sudo tcpdump -i any -n port 2055
```

### Add site with NetFlow in dashboard:
1. Click "Add Site"
2. Fill in basic info
3. Check "Enable NetFlow Monitoring"
4. NetFlow Port: `2055` (default)
5. Save

**Note:** NetFlow data appears after flows start arriving. May take 1-5 minutes.

---

## 🔌 API Monitoring (Meraki Only)

**Status:** ⚠️ Requires Meraki devices + API key

**What it monitors:**
- Device status and configuration
- Connected client count
- Uplink status
- Device models and serial numbers

**Requirements:**
- Cisco Meraki device (MX, MR, MS, etc.)
- Meraki Dashboard API access enabled
- API key generated

### How to get Meraki API key:

1. Log into [Meraki Dashboard](https://dashboard.meraki.com)
2. Organization → Settings
3. Scroll to "Dashboard API access"
4. Check "Enable access to the Cisco Meraki Dashboard API"
5. Click "Generate new API key"
6. **Copy the key** (you won't see it again!)

### Add Meraki site in dashboard:
1. Click "Add Site"
2. Fill in basic info
3. IP Address: Use the **public WAN IP** of the Meraki device
4. Check "Enable API Monitoring"
5. API Key: Paste your Meraki API key
6. Save

### Test API is working:
The dashboard will show device info if successful. Check browser console for errors.

---

## 🧪 Quick Test Setup

### Test with your existing sites (ICMP only - already working):

Your current sites are already being monitored via ICMP! ✅

**To add SNMP to an existing site:**
1. Configure SNMP on that device (see above)
2. Click the site card
3. Click "Edit Site"
4. Check "Enable SNMP Monitoring"
5. SNMP Community: `public`
6. Save

### Test with a local device (all methods):

**Option 1: Use your Windows machine**
1. Enable SNMP on Windows:
   - Control Panel → Programs → Turn Windows features on/off
   - Check "Simple Network Management Protocol (SNMP)"
   - Configure SNMP service with community "public"

2. Add site in dashboard:
   - Name: "Local Windows PC"
   - IP: `127.0.0.1` or your local IP
   - Enable ICMP + SNMP
   - Community: `public`

**Option 2: Use a lab router/firewall**
Configure one of your devices with all monitoring methods enabled (see configs above).

---

## 🔍 Troubleshooting

### ICMP not working:
- ❌ Firewall blocking ICMP on target device
- ❌ Target device down or unreachable
- ✅ Check: `ping <device-ip>` from NOC server

### SNMP not working:
- ❌ SNMP not enabled on device
- ❌ Wrong community string
- ❌ Firewall blocking UDP port 161
- ❌ SNMP configured with wrong version (use v2c)
- ✅ Check: `snmpwalk -v2c -c public <device-ip> system`

### NetFlow not working:
- ❌ NetFlow export not configured
- ❌ Wrong destination IP or port
- ❌ Firewall blocking UDP port 2055
- ❌ No traffic flowing through device (NetFlow needs traffic)
- ✅ Check: Server logs for "[NetFlow] Received flow data"
- ✅ Check: `tcpdump -i any -n port 2055`

### API (Meraki) not working:
- ❌ API access not enabled in dashboard
- ❌ Invalid or expired API key
- ❌ Wrong device IP (must be public WAN IP)
- ❌ Device not in same org as API key
- ✅ Check: Browser console for API errors

---

## 📈 What You'll See in Dashboard

### Grid View Cards:
- **Site name & customer**
- **Large latency number** (from ICMP)
- **Colored border:** Green = healthy, Red = down, Yellow = degraded
- **Alert badge** (if any issues)
- **Monitoring icons** at bottom (ICMP, SNMP, NetFlow, API)

### Site Detail Modal:
Click any site card to see:
- **Overview tab:** Basic site info
- **ICMP tab:** Latency graphs, packet loss
- **SNMP tab:** CPU/memory graphs, interface stats
- **NetFlow tab:** Top talkers, protocol pie chart
- **API tab:** Device info, client count, actions (reboot/blink)
- **Alerts tab:** Active alerts with acknowledge button

---

## 🎯 Recommended Setup

**For most sites:** Enable **ICMP + SNMP**
- ICMP gives you basic up/down + latency
- SNMP adds CPU/memory/interface stats
- Minimal overhead, easy to configure

**For critical sites:** Enable **all four methods**
- Complete visibility
- NetFlow shows what traffic is flowing
- API (if Meraki) allows remote management

**For simple monitoring:** Just **ICMP**
- Works immediately, no device config needed
- Perfect for endpoints, servers, printers, etc.

---

## 🔐 Security Notes

- SNMP community "public" is read-only and commonly used
- For production, use a custom community string
- Restrict SNMP access with ACLs on device
- Meraki API keys should be kept secret (never commit to git)
- NetFlow data is one-way (device → NOC), no security concerns

---

## ✨ Next Steps

1. **Verify ICMP is working** (already done - check dashboard!)
2. **Pick 1-2 test devices** to enable SNMP
3. **Configure SNMP** on those devices (see configs above)
4. **Edit sites in dashboard** to enable SNMP monitoring
5. **Wait 60 seconds** for first SNMP poll
6. **Click site card** to see SNMP data in detail modal

Once comfortable with SNMP, add NetFlow to a router to see traffic flows!

---

Need help? Check the server logs for monitoring activity:
```bash
# In terminal running npm run dev
# Look for lines like:
[Monitor] Starting monitoring for site X
[Monitor] Site X: operational - 69ms, 0% loss
SNMP CPU: 45%
SNMP Memory: 32%
[NetFlow] Received flow data from X.X.X.X
```
