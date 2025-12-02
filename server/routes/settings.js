const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const cache = require('../cache');

const router = express.Router();

// Cache key for system settings
const SETTINGS_CACHE_KEY = 'system:settings';
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get system settings
 * GET /api/settings
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    // Try cache first
    const cached = cache.get(SETTINGS_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    // Get or create default settings
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { id: 'system' }
      });
    }

    // Cache the result
    cache.set(SETTINGS_CACHE_KEY, settings, SETTINGS_CACHE_TTL);

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * Update system settings (admin only)
 * PUT /api/settings
 */
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      sessionTimeoutMinutes,
      dataRetentionDays,
      maxSitesPerUser,
      enableRegistration,
      maintenanceMode
    } = req.body;

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        sessionTimeoutMinutes: sessionTimeoutMinutes !== undefined ? parseInt(sessionTimeoutMinutes) : undefined,
        dataRetentionDays: dataRetentionDays !== undefined ? parseInt(dataRetentionDays) : undefined,
        maxSitesPerUser: maxSitesPerUser !== undefined ? parseInt(maxSitesPerUser) : undefined,
        enableRegistration: enableRegistration !== undefined ? Boolean(enableRegistration) : undefined,
        maintenanceMode: maintenanceMode !== undefined ? Boolean(maintenanceMode) : undefined
      },
      create: {
        id: 'system',
        sessionTimeoutMinutes: parseInt(sessionTimeoutMinutes) || 0,
        dataRetentionDays: parseInt(dataRetentionDays) || 30,
        maxSitesPerUser: parseInt(maxSitesPerUser) || 100,
        enableRegistration: Boolean(enableRegistration),
        maintenanceMode: Boolean(maintenanceMode)
      }
    });

    // Invalidate cache
    cache.del(SETTINGS_CACHE_KEY);

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'settings_updated',
        details: req.body
      }
    });

    res.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Get session timeout for token refresh decisions
 * GET /api/settings/session-timeout
 * Public endpoint (no auth required) for checking timeout
 */
router.get('/session-timeout', async (req, res) => {
  try {
    const cached = cache.get(SETTINGS_CACHE_KEY);
    if (cached) {
      return res.json({ sessionTimeoutMinutes: cached.sessionTimeoutMinutes });
    }

    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: { sessionTimeoutMinutes: true }
    });

    if (!settings) {
      settings = { sessionTimeoutMinutes: 0 }; // Default: never timeout
    }

    res.json(settings);
  } catch (error) {
    console.error('Get session timeout error:', error);
    res.json({ sessionTimeoutMinutes: 0 }); // Default on error
  }
});

module.exports = router;

