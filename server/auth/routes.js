const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { generateTokenPair, verifyRefreshToken } = require('./jwt');
const { requireAuth } = require('./middleware');
const limits = require('../limits');
const cache = require('../cache');

const router = express.Router();

// Helper to detect quota exceeded errors
function isQuotaExceededError(error) {
  return error?.message?.includes('exceeded the data transfer quota') ||
         error?.message?.includes('data transfer quota') ||
         error?.code === 'P1001' ||
         (error?.meta?.code === '53300' && error?.meta?.message?.includes('quota'));
}

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists (cached)
    const existingUser = await cache.getOrSet(
      cache.CACHE_KEYS.USER_BY_EMAIL + email,
      cache.TTL.USER,
      () => prisma.user.findUnique({ where: { email } })
    );

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Local database - no storage limits
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'user'
      }
    });

    // Invalidate user cache
    cache.invalidateUser(user.id, user.email);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Local database - no storage limits

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt
      }
    });

    // Local database - no limits
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user_registered',
        details: { email: user.email }
      }
    });

    // Return user data (without password) and tokens
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Register error:', error);
    
    // Check if it's a quota exceeded error
    if (isQuotaExceededError(error)) {
      return res.status(503).json({ 
        error: 'Database quota exceeded',
        message: 'Your Neon database has exceeded its monthly data transfer quota (5 GB). Please upgrade your plan or wait for the quota to reset.',
        code: 'QUOTA_EXCEEDED'
      });
    }
    
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user (cached)
    const user = await cache.getOrSet(
      cache.CACHE_KEYS.USER_BY_EMAIL + email,
      cache.TTL.USER,
      () => prisma.user.findUnique({ where: { email } })
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Clean up any existing refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id }
    });

    // Invalidate user cache after login
    cache.invalidateUser(user.id, user.email);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Local database - no storage limits

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt
      }
    });

    // Local database - no limits
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user_login',
        details: { email: user.email }
      }
    });

    // Return user data (without password) and tokens
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    
    // Check if it's a quota exceeded error
    if (isQuotaExceededError(error)) {
      return res.status(503).json({ 
        error: 'Database quota exceeded',
        message: 'Your Neon database has exceeded its monthly data transfer quota (5 GB). Please upgrade your plan or wait for the quota to reset. The quota resets monthly.',
        code: 'QUOTA_EXCEEDED'
      });
    }
    
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists in database and not expired (cached)
    const tokenRecord = await cache.getOrSet(
      cache.CACHE_KEYS.REFRESH_TOKEN + refreshToken,
      cache.TTL.REFRESH_TOKEN,
      () => prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
      })
    );

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }

    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(tokenRecord.user);

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { token: refreshToken }
    });

    // Invalidate token cache
    cache.invalidateRefreshToken(refreshToken);

    // Store new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Local database - no storage limits

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: tokenRecord.user.id,
        expiresAt
      }
    });

    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('Refresh error:', error);
    
    // Check if it's a quota exceeded error
    if (isQuotaExceededError(error)) {
      return res.status(503).json({ 
        error: 'Database quota exceeded',
        message: 'Your Neon database has exceeded its monthly data transfer quota (5 GB). Please upgrade your plan or wait for the quota to reset.',
        code: 'QUOTA_EXCEEDED'
      });
    }
    
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /auth/logout
 * Logout and invalidate refresh token
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    }

    // Local database - no limits
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'user_logout',
        details: { email: req.user.email }
      }
    });

    res.json({ message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    // Get user (cached)
    const user = await cache.getOrSet(
      cache.CACHE_KEYS.USER + req.user.userId,
      cache.TTL.USER,
      () => prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
      })
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    
    // Check if it's a quota exceeded error
    if (isQuotaExceededError(error)) {
      return res.status(503).json({ 
        error: 'Database quota exceeded',
        message: 'Your Neon database has exceeded its monthly data transfer quota (5 GB). Please upgrade your plan or wait for the quota to reset.',
        code: 'QUOTA_EXCEEDED'
      });
    }
    
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
