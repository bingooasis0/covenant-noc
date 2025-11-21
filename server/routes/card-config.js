const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get config
router.get('/', async (req, res) => {
    try {
        const { scope, targetId, viewType } = req.query;
        const userId = req.user?.userId;

        // Try to find specific config first
        let config = await prisma.cardConfiguration.findFirst({
            where: {
                userId: userId || undefined, // If no user, might be global system config (future)
                scope,
                targetId: targetId || null,
                viewType
            }
        });

        // If no specific config, try global scope for this user/view
        if (!config && scope === 'site') {
            config = await prisma.cardConfiguration.findFirst({
                where: {
                    userId: userId || undefined,
                    scope: 'global',
                    viewType
                }
            });
        }

        res.json(config || { layout: null });
    } catch (error) {
        console.error('Error fetching card config:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

// Save config
router.post('/', async (req, res) => {
    try {
        const { scope, targetId, viewType, layout } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const config = await prisma.cardConfiguration.upsert({
            where: {
                userId_scope_targetId_viewType: {
                    userId,
                    scope,
                    targetId: targetId || '', // Prisma unique constraint needs a value, but let's handle nulls carefully
                    viewType
                }
            },
            update: {
                layout
            },
            create: {
                userId,
                scope,
                targetId: targetId || '',
                viewType,
                layout
            }
        });

        res.json(config);
    } catch (error) {
        console.error('Error saving card config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

module.exports = router;
