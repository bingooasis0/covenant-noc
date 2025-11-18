# Neon Free Tier Limits Implementation

## Overview

This document describes the comprehensive limits management system implemented to ensure the application stays within Neon's free tier limits:

- **Storage:** 0.5 GB (512 MB)
- **Compute:** 100 CU-hrs/month
- **Network Transfer:** 5 GB/month
- **Branches:** 10

## Implementation Details

### 1. Limits Module (`server/limits.js`)

A comprehensive limits management module that:

- **Monitors Storage Usage:** Estimates storage usage for all tables
- **Checks Before Operations:** Validates storage limits before creating new records
- **Automatic Cleanup:** Runs cleanup based on retention policies
- **Aggressive Cleanup:** Reduces retention periods when approaching limits
- **Usage Statistics:** Provides detailed usage breakdown

#### Key Functions:

- `estimateStorageUsage()` - Calculates current storage usage
- `checkStorageLimit(estimatedBytes)` - Validates if operation is allowed
- `checkBeforeCreate(model, bytes)` - Middleware for pre-create validation
- `runAutomaticCleanup()` - Runs cleanup based on retention policies
- `aggressiveCleanup()` - More aggressive cleanup when near limits
- `getUsageStats()` - Returns detailed usage statistics

### 2. Retention Policies

**Normal Retention:**
- Monitoring Data: 7 days
- SNMP Data: 7 days
- Audit Logs: 30 days
- Refresh Tokens: 7 days after expiry

**Aggressive Retention (when >80% storage):**
- Monitoring Data: 3 days
- SNMP Data: 3 days
- Audit Logs: 14 days
- Refresh Tokens: 7 days after expiry

### 3. Storage Estimates Per Record

- **User:** ~500 bytes
- **Site:** ~800 bytes
- **MonitoringData:** ~100 bytes
- **SnmpData:** ~200 bytes
- **Preset:** ~500 bytes + config size
- **AuditLog:** ~300 bytes + details size
- **RefreshToken:** ~200 bytes

### 4. Integration Points

#### API Routes (`server/index.js`)
- `POST /api/sites` - Checks limits before creating sites
- `POST /api/presets` - Checks limits before creating presets
- `POST /api/audit` - Checks limits before creating audit logs
- `POST /api/users` - Checks limits before creating users
- `GET /api/limits/usage` - Returns current usage statistics

#### Authentication (`server/auth/routes.js`)
- `POST /auth/register` - Checks limits before creating users and tokens
- `POST /auth/login` - Checks limits before creating tokens
- `POST /auth/refresh` - Checks limits before creating tokens
- All audit log creations are protected

#### Monitoring (`server/monitoring.js`)
- Every monitoring data record creation checks limits
- Every SNMP data record creation checks limits
- Cleanup delegated to limits module

### 5. Error Handling

When storage limits are exceeded:
- **HTTP 507 (Insufficient Storage)** status code
- Clear error message explaining the limit
- Automatic cleanup attempt before failing
- User-friendly error messages

### 6. Automatic Cleanup Schedule

- **Initial Cleanup:** Runs on server startup
- **Regular Cleanup:** Every 6 hours
- **Monitoring Cleanup:** Every hour (delegated to limits module)
- **Aggressive Cleanup:** Triggered when storage >80%

### 7. Usage Monitoring

The system logs storage usage on startup:
```
✓ Storage usage: 0.05 GB / 0.5 GB (10.0%)
⚠️  WARNING: Storage usage is at 85.0% - consider cleanup
```

### 8. Data Migration Protection

The migration script (`scripts/migrate-data-to-neon.js`) includes:
- Pre-migration storage check
- Data size estimation
- Validation before importing
- Clear error messages if limits would be exceeded

## Usage

### Check Current Usage

```bash
# Via API (requires authentication)
GET /api/limits/usage

# Response:
{
  "storage": {
    "used": 0.05,
    "limit": 0.5,
    "percentage": 10.0,
    "breakdown": {
      "users": 0.001,
      "sites": 0.01,
      "monitoringData": 0.03,
      "snmpData": 0.005,
      "presets": 0.001,
      "auditLogs": 0.002,
      "refreshTokens": 0.001,
      "overhead": 0.01
    }
  },
  "compute": {
    "limit": 100,
    "note": "Compute usage is tracked by Neon. Monitor in Neon dashboard."
  },
  "network": {
    "limit": 5,
    "note": "Network transfer is tracked by Neon. Monitor in Neon dashboard."
  },
  "retention": {
    "MONITORING_DATA": 7,
    "SNMP_DATA": 7,
    "AUDIT_LOGS": 30,
    "REFRESH_TOKENS": 7
  }
}
```

### Manual Cleanup

The limits module can be used programmatically:

```javascript
const limits = require('./server/limits');

// Run automatic cleanup
await limits.runAutomaticCleanup();

// Run aggressive cleanup
await limits.aggressiveCleanup();

// Get usage stats
const stats = await limits.getUsageStats();
```

## Important Notes

### What Gets Protected

✅ **Protected (Never Deleted):**
- Users table
- Sites table
- Presets table

⚠️ **Protected with Retention:**
- Monitoring Data (7 days normal, 3 days aggressive)
- SNMP Data (7 days normal, 3 days aggressive)
- Audit Logs (30 days normal, 14 days aggressive)
- Refresh Tokens (7 days after expiry)

### Compute & Network Limits

- **Compute:** Tracked by Neon automatically. Monitor in Neon dashboard.
- **Network Transfer:** Tracked by Neon automatically. Monitor in Neon dashboard.
- These cannot be programmatically limited, but storage limits help reduce data transfer.

### Best Practices

1. **Monitor Regularly:** Check `/api/limits/usage` regularly
2. **Clean Up Old Data:** Old monitoring/SNMP data is automatically cleaned, but you can manually trigger cleanup
3. **Watch for Warnings:** When storage >80%, aggressive cleanup runs automatically
4. **Plan for Growth:** If approaching limits, consider:
   - Reducing monitoring frequency
   - Reducing retention periods
   - Upgrading Neon plan

## Migration Considerations

When migrating from SQLite to Neon:

1. **Check Data Size:** The migration script checks storage limits before importing
2. **Clean Old Data:** Consider cleaning old monitoring/SNMP data before migrating
3. **Verify Limits:** After migration, check usage stats to ensure you're within limits
4. **Monitor Growth:** Watch usage patterns to adjust retention policies if needed

## Future Enhancements

Potential improvements:
- Real-time storage monitoring dashboard
- Email alerts when approaching limits
- Configurable retention policies per environment
- Automatic monitoring frequency adjustment based on storage usage
- Compute usage estimation (if Neon provides API)

