const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// ============ SECRETS & KEYS ROUTES ============
router.get('/', async (req, res) => {
  try {
    const secrets = await prisma.secret.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        // NOT returning value for security list view
      }
    });
    res.json(secrets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch secrets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const secret = await prisma.secret.findUnique({
      where: { id: req.params.id }
    });
    if (!secret) return res.status(404).json({ error: 'Secret not found' });
    res.json(secret); // Returns full secret including value
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch secret' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, value, type } = req.body;
    if (!name || !value) return res.status(400).json({ error: 'Name and value are required' });

    const secret = await prisma.secret.create({
      data: {
        name,
        value,
        type: type || 'meraki_api_key'
      }
    });
    res.json(secret);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create secret' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.secret.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete secret' });
  }
});

module.exports = router;
