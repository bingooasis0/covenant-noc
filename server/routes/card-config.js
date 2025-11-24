const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cache = require('../cache');

// Get config
router.get('/', async (req, res) => {
    try {
        const { scope, targetId, viewType } = req.query;
        const userId = req.user?.userId;

        // Normalize targetId to empty string if missing, to match how we save it
        const dbTargetId = targetId || '';
        const cacheKey = `${cache.CACHE_KEYS.CARD_CONFIG}${userId || 'global'}:${scope}:${dbTargetId}:${viewType}`;

        // Try to get from cache first
        let config = cache.get(cacheKey);

        if (!config) {
            // Try to find specific config first
            config = await prisma.cardConfiguration.findFirst({
                where: {
                    userId: userId || undefined, // If no user, might be global system config (future)
                    scope,
                    targetId: dbTargetId,
                    viewType
                }
            });

            // If no specific config, try global scope for this user/view
            if (!config && scope === 'site') {
                config = await prisma.cardConfiguration.findFirst({
                    where: {
                        userId: userId || undefined,
                        scope: 'global',
                        // Ensure we only get global configs (empty targetId)
                        targetId: '', 
                        viewType
                    }
                });
            }

            // Only cache if we found a config (don't cache null/empty results)
            if (config && config.layout) {
              cache.set(cacheKey, config, cache.TTL.CARD_CONFIG);
            }
            // If no config found, return null layout
            if (!config) {
              config = { layout: null };
            }
        }
        
        console.log(`[Get] Card config retrieved:`, {
          userId: userId || 'global',
          scope,
          targetId: dbTargetId,
          viewType,
          hasLayout: !!config?.layout,
          layoutType: Array.isArray(config?.layout) ? 'array' : typeof config?.layout,
          fromCache: !!cache.get(cacheKey)
        });

        res.json(config);
    } catch (error) {
        console.error('Error fetching card config:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

// Save config
router.post('/', async (req, res) => {
    try {
        const { scope, targetId, viewType, layout, cardConfig } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`Saving card config: User=${userId}, Scope=${scope}, Target=${targetId}, View=${viewType}`);

        // Wrap layout and cardConfig into a single object to store in the JSON column
        const dataToStore = {
            layout: layout, // The component tree
            cardConfig: cardConfig || {} // The panel configuration (height, etc.)
        };

        const config = await prisma.cardConfiguration.upsert({
            where: {
                userId_scope_targetId_viewType: {
                    userId,
                    scope,
                    targetId: targetId || '', // Use empty string for null/undefined to satisfy unique constraint if needed
                    viewType
                }
            },
            update: {
                layout: dataToStore
            },
            create: {
                userId,
                scope,
                targetId: targetId || '',
                viewType,
                layout: dataToStore
            }
        });

        // Invalidate cache - clear both the specific key and related keys
        const targetIdForCache = targetId || '';
        const cacheKey = `${cache.CACHE_KEYS.CARD_CONFIG}${userId}:${scope}:${targetIdForCache}:${viewType}`;
        cache.del(cacheKey);
        
        // Also invalidate global fallback if this is a site config
        if (scope === 'site') {
          const globalCacheKey = `${cache.CACHE_KEYS.CARD_CONFIG}${userId}:global::${viewType}`;
          cache.del(globalCacheKey);
        }
        
        console.log(`[Save] Card config saved successfully:`, {
          userId,
          scope,
          targetId: targetIdForCache,
          viewType,
          layoutIsArray: Array.isArray(dataToStore.layout),
          layoutLength: Array.isArray(dataToStore.layout) ? dataToStore.layout.length : 'N/A',
          cardConfigKeys: Object.keys(dataToStore.cardConfig || {}),
          cacheKeyInvalidated: cacheKey
        });

        res.json(config);
    } catch (error) {
        console.error('Error saving card config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

module.exports = router;
