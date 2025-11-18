# Meraki MX67 Configuration for NOCTURNAL

## 🔧 Meraki Dashboard Setup

### 1. Enable SNMP

**Location:** Network-wide > General > Reporting

**Settings:**
- **SNMP access:** V1/V2c (community string)
- **Community string:** `covenant-technology`
- **Allowed remote IPs:** `Any` (or add `47.226.62.123` specifically)

**Firewall Rules Needed:**
- **Protocol:** UDP
- **Port:** 161
- **Direction:** Inbound from `47.226.62.123`
- **Action:** Allow

---

### 2. Enable NetFlow

**Location:** Network-wide > General > Reporting

**Settings:**
- **NetFlow traffic reporting:** Enabled
- **NetFlow collector IP:** `47.226.62.123`
- **NetFlow collector port:** `2055`
- **Note:** You may also see this under "Syslog servers" with role "Flows"

**Firewall Rules Needed:**
- **Protocol:** UDP
- **Port:** 2055
- **Direction:** Outbound to `47.226.62.123`
- **Action:** Allow

---

## 🧪 Testing

### Test SNMP Connectivity
```bash
node test-snmp.js 104.51.127.33 covenant-technology
```

**Expected Output:**
```
✅ SNMP Connection Successful!

📊 Metrics Collected:
🖥️  CPU Usage: 12%
💾 Memory: 2048 MB total, 1024 MB used (50%)
⏱️  Uptime: 45d 12h 34m
🌐 Interfaces: 8 found
```

**If it fails:**
1. Check SNMP is enabled in Meraki dashboard
2. Verify community string matches exactly
3. Check firewall allows UDP 161 from your monitoring server
4. Ping the MX to verify connectivity

---

### Test NetFlow Reception
```bash
node test-netflow.js
```

**Expected Output:**
```
✅ Packet #1 received from 104.51.127.33:xxxxx
   Size: 1420 bytes
```

**If it fails:**
1. Verify NetFlow is enabled in Meraki dashboard
2. Check collector IP is correct: `47.226.62.123`
3. Check collector port is correct: `2055`
4. Ensure firewall allows UDP 2055 inbound
5. Generate some traffic through the MX (browse websites, etc.)
6. NetFlow may take 5-10 minutes to start sending data

---

## 🔥 Windows Firewall Rules (if running on Windows Server)

### Allow SNMP (UDP 161)
```powershell
New-NetFirewallRule -DisplayName "NOCTURNAL SNMP" -Direction Inbound -Protocol UDP -LocalPort 161 -Action Allow
```

### Allow NetFlow (UDP 2055)
```powershell
New-NetFirewallRule -DisplayName "NOCTURNAL NetFlow" -Direction Inbound -Protocol UDP -LocalPort 2055 -Action Allow
```

---

## 📋 NOCTURNAL Configuration

When adding/editing the site in NOCTURNAL:

**Site Details:**
- **IP Address:** `104.51.127.33`
- **Customer:** Office/Main Site
- **ISP:** Spectrum
- **Device:** Meraki MX67

**Monitoring Methods:**
- ✅ **ICMP Ping** - Always enabled
- ✅ **SNMP**
  - Community: `covenant-technology`
- ✅ **NetFlow**
  - Port: `2055`
- ❌ **API** - Not configured yet

---

## 🐛 Troubleshooting

### SNMP Not Working
1. **Test with snmpwalk (if available):**
   ```bash
   snmpwalk -v2c -c covenant-technology 104.51.127.33 system
   ```

2. **Check MX local status page:**
   - Navigate to: `http://104.51.127.33` (from local network)
   - Verify SNMP is enabled

3. **Verify community string case-sensitivity**

### NetFlow Not Working
1. **Check if port is listening:**
   ```bash
   netstat -an | findstr :2055
   ```

2. **Verify traffic is flowing through MX:**
   - NetFlow only sends data when there's actual traffic
   - Browse websites, download files, etc. to generate flows

3. **Check Meraki event log:**
   - Network-wide > Event log
   - Look for NetFlow-related events

4. **Collector IP must be reachable from MX:**
   - MX must be able to reach `47.226.62.123` on UDP 2055
   - Check any intermediate firewalls

---

## 📊 Expected Data

### SNMP Metrics (every 60 seconds):
- CPU usage percentage
- Memory usage (total, used, available)
- Interface statistics (bandwidth in/out)
- System uptime

### NetFlow Data (real-time):
- Total flows/packets/bytes
- Protocol distribution (TCP, UDP, ICMP, etc.)
- Top talkers (source IPs with most traffic)
- Top applications (by port: HTTP, HTTPS, DNS, etc.)

---

## 🎯 Quick Start Checklist

- [ ] Enable SNMP on Meraki dashboard
- [ ] Set community string to `covenant-technology`
- [ ] Enable NetFlow on Meraki dashboard
- [ ] Set NetFlow collector to `47.226.62.123:2055`
- [ ] Allow UDP 161 (SNMP) through firewall
- [ ] Allow UDP 2055 (NetFlow) through firewall
- [ ] Run `node test-snmp.js` to verify SNMP
- [ ] Run `node test-netflow.js` to verify NetFlow reception
- [ ] Add site in NOCTURNAL with SNMP and NetFlow enabled
- [ ] Wait 1-2 minutes and check SNMP/NetFlow tabs in dashboard
