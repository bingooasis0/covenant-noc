/**
 * Neon Free Tier Limits Management
 * 
 * Free Tier Limits:
 * - Storage: 0.5 GB (512 MB)
 * - Compute: 100 CU-hrs/month
 * - Network Transfer: 5 GB/month
 * - Branches: 10
 * 
 * This module monitors usage and prevents exceeding limits.
 * 
 * NOTE: Limits are automatically disabled for local databases (localhost)
 */

const prisma = require('./prisma');
const cache = require('./cache');

// Check if we're using a local database
function isLocalDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('postgresql://postgres:password@localhost');
}

// Helper to detect quota exceeded errors
function isQuotaExceededError(error) {
  return error?.message?.includes('exceeded the data transfer quota') ||
         error?.message?.includes('data transfer quota') ||
         error?.code === 'P1001' ||
         (error?.meta?.code === '53300' && error?.meta?.message?.includes('quota'));
}

// Free tier limits (in bytes/hours/bytes)
const LIMITS = {
  STORAGE_BYTES: 0.5 * 1024 * 1024 * 1024, // 0.5 GB = 536,870,912 bytes
  COMPUTE_CU_HRS: 100, // Compute Unit Hours per month
  NETWORK_TRANSFER_BYTES: 5 * 1024 * 1024 * 1024, // 5 GB = 5,368,709,120 bytes
  BRANCHES: 10
};

// Warning thresholds (percentage)
const WARNING_THRESHOLDS = {
  STORAGE: 0.8, // 80% = 429,496,730 bytes
  COMPUTE: 0.8, // 80% = 80 CU-hrs
  NETWORK: 0.8, // 80% = 4,294,967,296 bytes
};

// Data retention policies (in days)
const RETENTION_POLICIES = {
  MONITORING_DATA: 7, // Keep last 7 days
  SNMP_DATA: 7, // Keep last 7 days
  AUDIT_LOGS: 30, // Keep last 30 days
  REFRESH_TOKENS: 7, // Keep expired tokens for 7 days after expiry
};

/**
 * Estimate storage usage for each table
 */
async function estimateStorageUsage() {
  try {
    // Get row counts and estimate sizes
    const [users, sites, monitoringData, snmpData, presets, auditLogs, refreshTokens] = await Promise.all([
      prisma.user.count(),
      prisma.site.count(),
      prisma.monitoringData.count(),
      prisma.snmpData.count(),
      prisma.preset.count(),
      prisma.auditLog.count(),
      prisma.refreshToken.count()
    ]).catch(error => {
      // If quota exceeded, return null to skip storage estimation
      if (isQuotaExceededError(error)) {
        console.warn('[Limits] Skipping storage estimation - quota exceeded');
        return null;
      }
      throw error;
    });
    
    // If quota exceeded, return null
    if (!users && users !== 0) {
      return null;
    }

    // Rough size estimates per row (in bytes)
    const ESTIMATES = {
      User: 500, // id, email, password hash, names, role, timestamps
      Site: 800, // id, name, customer, location, IPs, coordinates, configs, status
      MonitoringData: 100, // id, siteId, 3 floats, timestamp
      SnmpData: 200, // id, siteId, floats, JSON, timestamp
      Preset: 500, // id, name, JSON config, timestamps
      AuditLog: 300, // id, userId, action, JSON details, timestamp
      RefreshToken: 200 // id, token, userId, timestamps
    };

    const usage = {
      users: users * ESTIMATES.User,
      sites: sites * ESTIMATES.Site,
      monitoringData: monitoringData * ESTIMATES.MonitoringData,
      snmpData: snmpData * ESTIMATES.SnmpData,
      presets: presets * ESTIMATES.Preset,
      auditLogs: auditLogs * ESTIMATES.AuditLog,
      refreshTokens: refreshTokens * ESTIMATES.RefreshToken,
      // Add 20% overhead for indexes and metadata
      overhead: (users * ESTIMATES.User + sites * ESTIMATES.Site + 
                 monitoringData * ESTIMATES.MonitoringData + 
                 snmpData * ESTIMATES.SnmpData + 
                 presets * ESTIMATES.Preset + 
                 auditLogs * ESTIMATES.AuditLog + 
                 refreshTokens * ESTIMATES.RefreshToken) * 0.2
    };

    const totalBytes = Object.values(usage).reduce((sum, val) => sum + val, 0);
    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalBytes / (1024 * 1024 * 1024);

    return {
      breakdown: usage,
      totalBytes,
      totalMB: Math.round(totalMB * 100) / 100,
      totalGB: Math.round(totalGB * 1000) / 1000,
      percentage: (totalBytes / LIMITS.STORAGE_BYTES) * 100,
      limitGB: LIMITS.STORAGE_BYTES / (1024 * 1024 * 1024),
      isOverLimit: totalBytes > LIMITS.STORAGE_BYTES,
      isNearLimit: totalBytes > LIMITS.STORAGE_BYTES * WARNING_THRESHOLDS.STORAGE
    };
  } catch (error) {
    console.error('[Limits] Error estimating storage:', error);
    return null;
  }
}

/**
 * Check if we can perform an operation without exceeding limits
 */
async function checkStorageLimit(estimatedAdditionalBytes = 0) {
  // Skip limit checks for local databases
  if (isLocalDatabase()) {
    return {
      allowed: true,
      currentUsage: { totalGB: 0, limitGB: Infinity },
      projectedTotal: 0,
      projectedGB: 0,
      reason: null
    };
  }

  const usage = await estimateStorageUsage();
  if (!usage) return { allowed: false, reason: 'Could not estimate storage' };

  const projectedTotal = usage.totalBytes + estimatedAdditionalBytes;
  const allowed = projectedTotal <= LIMITS.STORAGE_BYTES;

  return {
    allowed,
    currentUsage: usage,
    projectedTotal,
    projectedGB: Math.round((projectedTotal / (1024 * 1024 * 1024)) * 1000) / 1000,
    reason: allowed ? null : `Projected storage (${Math.round((projectedTotal / (1024 * 1024 * 1024)) * 1000) / 1000} GB) exceeds limit (${usage.limitGB} GB)`
  };
}

/**
 * Clean up old monitoring data (keep last N days)
 */
async function cleanupMonitoringData(days = RETENTION_POLICIES.MONITORING_DATA) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await prisma.monitoringData.deleteMany({
      where: {
        timestamp: { lt: cutoff }
      }
    });

    console.log(`[Limits] Cleaned up ${result.count} monitoring data records older than ${days} days`);
    return result.count;
  } catch (error) {
    console.error('[Limits] Error cleaning monitoring data:', error);
    return 0;
  }
}

/**
 * Clean up old SNMP data (keep last N days)
 */
async function cleanupSnmpData(days = RETENTION_POLICIES.SNMP_DATA) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await prisma.snmpData.deleteMany({
      where: {
        timestamp: { lt: cutoff }
      }
    });

    console.log(`[Limits] Cleaned up ${result.count} SNMP data records older than ${days} days`);
    return result.count;
  } catch (error) {
    console.error('[Limits] Error cleaning SNMP data:', error);
    return 0;
  }
}

/**
 * Clean up old audit logs (keep last N days)
 */
async function cleanupAuditLogs(days = RETENTION_POLICIES.AUDIT_LOGS) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoff }
      }
    });

    console.log(`[Limits] Cleaned up ${result.count} audit log records older than ${days} days`);
    return result.count;
  } catch (error) {
    console.error('[Limits] Error cleaning audit logs:', error);
    return 0;
  }
}

/**
 * Clean up expired refresh tokens
 */
async function cleanupExpiredTokens() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_POLICIES.REFRESH_TOKENS);

    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: cutoff }
      }
    });

    console.log(`[Limits] Cleaned up ${result.count} expired refresh tokens`);
    return result.count;
  } catch (error) {
    console.error('[Limits] Error cleaning expired tokens:', error);
    return 0;
  }
}

/**
 * Aggressive cleanup when approaching storage limit
 */
async function aggressiveCleanup() {
  console.log('[Limits] Running aggressive cleanup...');
  
  // Reduce retention periods when near limit
  const monitoringDeleted = await cleanupMonitoringData(3); // Keep only 3 days
  const snmpDeleted = await cleanupSnmpData(3); // Keep only 3 days
  const auditDeleted = await cleanupAuditLogs(14); // Keep only 14 days
  const tokensDeleted = await cleanupExpiredTokens();

  const totalDeleted = monitoringDeleted + snmpDeleted + auditDeleted + tokensDeleted;
  console.log(`[Limits] Aggressive cleanup complete: ${totalDeleted} records deleted`);

  // Invalidate usage stats cache after cleanup
  cache.invalidateUsageStats();

  return totalDeleted;
}

/**
 * Run automatic cleanup based on retention policies
 */
async function runAutomaticCleanup() {
  // Skip cleanup for local databases (no limits)
  if (isLocalDatabase()) {
    return;
  }

  try {
    const usage = await estimateStorageUsage();
    if (!usage) return;

    // If over 80% storage, run aggressive cleanup
    if (usage.isNearLimit) {
      console.log(`[Limits] Storage at ${usage.percentage.toFixed(1)}% - running aggressive cleanup`);
      await aggressiveCleanup();
    } else {
      // Normal cleanup based on retention policies
      await cleanupMonitoringData();
      await cleanupSnmpData();
      await cleanupAuditLogs();
      await cleanupExpiredTokens();
    }

    // Log current usage
    const updatedUsage = await estimateStorageUsage();
    if (updatedUsage) {
      console.log(`[Limits] Storage usage: ${updatedUsage.totalMB} MB / ${updatedUsage.limitGB} GB (${updatedUsage.percentage.toFixed(1)}%)`);
    }
    
    // Invalidate usage stats cache after cleanup
    cache.invalidateUsageStats();
  } catch (error) {
    console.error('[Limits] Error in automatic cleanup:', error);
  }
}

/**
 * Middleware to check storage limits before operations
 */
async function checkBeforeCreate(model, estimatedBytes) {
  try {
    const check = await checkStorageLimit(estimatedBytes);
    
    // If we couldn't estimate storage (database connection issue), allow the operation
    // but log a warning
    if (!check.allowed && check.reason === 'Could not estimate storage') {
      console.warn(`[Limits] Could not check storage limits (database connection issue), allowing operation`);
      return true;
    }
    
    if (!check.allowed) {
      // Try cleanup first
      console.log(`[Limits] Storage limit check failed, attempting cleanup...`);
      await aggressiveCleanup();
      
      // Check again after cleanup
      const recheck = await checkStorageLimit(estimatedBytes);
      if (!recheck.allowed && recheck.reason !== 'Could not estimate storage') {
        throw new Error(`Storage limit exceeded: ${recheck.reason}. Please delete old data or upgrade your plan.`);
      }
    }

    // Warn if approaching limit (only if we have usage data)
    if (check.currentUsage && check.currentUsage.isNearLimit) {
      console.warn(`[Limits] WARNING: Storage at ${check.currentUsage.percentage.toFixed(1)}% - consider cleanup`);
    }

    return true;
  } catch (error) {
    // If it's a database connection error, allow the operation
    if (isQuotaExceededError(error) || error?.code === 'P1001') {
      console.warn(`[Limits] Database connection error during limit check, allowing operation:`, error.message);
      return true;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get current usage statistics (cached)
 */
async function getUsageStats() {
  // Skip limit checks for local databases
  if (isLocalDatabase()) {
    const storage = await estimateStorageUsage();
    return {
      storage: storage ? {
        used: storage.totalGB,
        limit: Infinity,
        percentage: 0,
        breakdown: {
          users: Math.round((storage.breakdown.users / (1024 * 1024)) * 100) / 100,
          sites: Math.round((storage.breakdown.sites / (1024 * 1024)) * 100) / 100,
          monitoringData: Math.round((storage.breakdown.monitoringData / (1024 * 1024)) * 100) / 100,
          snmpData: Math.round((storage.breakdown.snmpData / (1024 * 1024)) * 100) / 100,
          presets: Math.round((storage.breakdown.presets / (1024 * 1024)) * 100) / 100,
          auditLogs: Math.round((storage.breakdown.auditLogs / (1024 * 1024)) * 100) / 100,
          refreshTokens: Math.round((storage.breakdown.refreshTokens / (1024 * 1024)) * 100) / 100,
          overhead: Math.round((storage.breakdown.overhead / (1024 * 1024)) * 100) / 100
        }
      } : null,
      compute: {
        limit: Infinity,
        note: 'Local database - no compute limits'
      },
      network: {
        limit: Infinity,
        note: 'Local database - no network transfer limits'
      },
      retention: RETENTION_POLICIES
    };
  }

  // Cache usage stats to avoid frequent count queries
  return await cache.getOrSet(
    cache.CACHE_KEYS.USAGE_STATS,
    cache.TTL.USAGE_STATS,
    async () => {
      const storage = await estimateStorageUsage();
      
      return {
        storage: storage ? {
          used: storage.totalGB,
          limit: storage.limitGB,
          percentage: storage.percentage,
          breakdown: {
            users: Math.round((storage.breakdown.users / (1024 * 1024)) * 100) / 100,
            sites: Math.round((storage.breakdown.sites / (1024 * 1024)) * 100) / 100,
            monitoringData: Math.round((storage.breakdown.monitoringData / (1024 * 1024)) * 100) / 100,
            snmpData: Math.round((storage.breakdown.snmpData / (1024 * 1024)) * 100) / 100,
            presets: Math.round((storage.breakdown.presets / (1024 * 1024)) * 100) / 100,
            auditLogs: Math.round((storage.breakdown.auditLogs / (1024 * 1024)) * 100) / 100,
            refreshTokens: Math.round((storage.breakdown.refreshTokens / (1024 * 1024)) * 100) / 100,
            overhead: Math.round((storage.breakdown.overhead / (1024 * 1024)) * 100) / 100
          }
        } : null,
        compute: {
          limit: LIMITS.COMPUTE_CU_HRS,
          note: 'Compute usage is tracked by Neon. Monitor in Neon dashboard.'
        },
        network: {
          limit: LIMITS.NETWORK_TRANSFER_BYTES / (1024 * 1024 * 1024), // Convert to GB
          note: 'Network transfer is tracked by Neon. Monitor in Neon dashboard.'
        },
        retention: RETENTION_POLICIES
      };
    }
  );
}

module.exports = {
  LIMITS,
  WARNING_THRESHOLDS,
  RETENTION_POLICIES,
  estimateStorageUsage,
  checkStorageLimit,
  checkBeforeCreate,
  cleanupMonitoringData,
  cleanupSnmpData,
  cleanupAuditLogs,
  cleanupExpiredTokens,
  aggressiveCleanup,
  runAutomaticCleanup,
  getUsageStats
};

