/**
 * Centralized Caching System
 * 
 * Uses node-cache to minimize database queries and reduce data transfer.
 * Implements TTL-based caching with automatic invalidation.
 */

const NodeCache = require('node-cache');

// Create cache instance with default TTL
// stdTTL: default TTL in seconds
// checkperiod: interval to check for expired keys
const cache = new NodeCache({
  stdTTL: 60, // Default 60 seconds
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Better performance, but be careful with mutations
  deleteOnExpire: true,
  maxKeys: 10000 // Prevent memory issues
});

// Cache key prefixes for organization
const CACHE_KEYS = {
  USER: 'user:',
  USER_BY_EMAIL: 'user:email:',
  SITES: 'sites:',
  SITE: 'site:',
  MONITORING_LATEST: 'monitoring:latest:',
  MONITORING_HISTORY: 'monitoring:history:',
  SNMP_LATEST: 'snmp:latest:',
  CARD_CONFIG: 'card:config:',
  PRESETS: 'presets:',
  PRESET: 'preset:',
  USAGE_STATS: 'usage:stats',
  REFRESH_TOKEN: 'refresh:token:',
};

// TTL values in seconds
const TTL = {
  USER: 300, // 5 minutes - users don't change often
  SITES: 30, // 30 seconds - sites change occasionally
  SITE: 60, // 1 minute - individual site details
  MONITORING_LATEST: 10, // 10 seconds - monitoring data changes frequently
  MONITORING_HISTORY: 30, // 30 seconds - history doesn't need to be super fresh
  SNMP_LATEST: 15, // 15 seconds - SNMP data changes frequently
  CARD_CONFIG: 300, // 5 minutes - configs don't change often
  PRESETS: 600, // 10 minutes - presets rarely change
  USAGE_STATS: 300, // 5 minutes - stats don't need to be super fresh
  REFRESH_TOKEN: 60, // 1 minute - tokens checked frequently
};

/**
 * Get cached value or execute function and cache result
 */
async function getOrSet(key, ttl, fetchFn) {
  // Try to get from cache
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // Not in cache, fetch and store
  try {
    const value = await fetchFn();
    if (value !== null && value !== undefined) {
      cache.set(key, value, ttl);
    }
    return value;
  } catch (error) {
    // If fetch fails, don't cache the error
    throw error;
  }
}

/**
 * Get cached value
 */
function get(key) {
  return cache.get(key);
}

/**
 * Set cached value
 */
function set(key, value, ttl) {
  return cache.set(key, value, ttl);
}

/**
 * Delete cached value(s)
 */
function del(key) {
  return cache.del(key);
}

/**
 * Delete multiple keys matching a pattern
 */
function delPattern(pattern) {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  if (matchingKeys.length > 0) {
    cache.del(matchingKeys);
    return matchingKeys.length;
  }
  return 0;
}

/**
 * Clear all cache
 */
function flush() {
  cache.flushAll();
}

/**
 * Get cache statistics
 */
function getStats() {
  return cache.getStats();
}

/**
 * Invalidate user-related cache
 */
function invalidateUser(userId, email) {
  if (userId) del(CACHE_KEYS.USER + userId);
  if (email) del(CACHE_KEYS.USER_BY_EMAIL + email);
}

/**
 * Invalidate site-related cache
 */
function invalidateSite(siteId) {
  del(CACHE_KEYS.SITE + siteId);
  delPattern(CACHE_KEYS.SITES); // Invalidate all site lists
  // Also invalidate monitoring data for this site
  del(CACHE_KEYS.MONITORING_LATEST + siteId);
  delPattern(CACHE_KEYS.MONITORING_HISTORY + siteId);
  del(CACHE_KEYS.SNMP_LATEST + siteId);
}

/**
 * Invalidate all sites cache
 */
function invalidateSites() {
  delPattern(CACHE_KEYS.SITES);
  delPattern(CACHE_KEYS.SITE);
}

/**
 * Invalidate monitoring data cache for a site
 */
function invalidateMonitoring(siteId) {
  del(CACHE_KEYS.MONITORING_LATEST + siteId);
  delPattern(CACHE_KEYS.MONITORING_HISTORY + siteId);
}

/**
 * Invalidate SNMP data cache for a site
 */
function invalidateSnmp(siteId) {
  del(CACHE_KEYS.SNMP_LATEST + siteId);
}

/**
 * Invalidate card config cache
 */
function invalidateCardConfig(userId, scope, targetId, viewType) {
  const key = `${CACHE_KEYS.CARD_CONFIG}${userId || 'global'}:${scope}:${targetId || ''}:${viewType}`;
  del(key);
  // Also invalidate related configs
  if (scope === 'site') {
    del(`${CACHE_KEYS.CARD_CONFIG}${userId || 'global'}:global::${viewType}`);
  }
}

/**
 * Invalidate usage stats cache
 */
function invalidateUsageStats() {
  del(CACHE_KEYS.USAGE_STATS);
}

/**
 * Invalidate refresh token cache
 */
function invalidateRefreshToken(token) {
  del(CACHE_KEYS.REFRESH_TOKEN + token);
}

module.exports = {
  CACHE_KEYS,
  TTL,
  getOrSet,
  get,
  set,
  del,
  delPattern,
  flush,
  getStats,
  invalidateUser,
  invalidateSite,
  invalidateSites,
  invalidateMonitoring,
  invalidateSnmp,
  invalidateCardConfig,
  invalidateUsageStats,
  invalidateRefreshToken,
};

