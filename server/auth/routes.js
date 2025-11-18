const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { generateTokenPair, verifyRefreshToken } = require('./jwt');
const { requireAuth } = require('./middleware');
const limits = require('../limits');

const router = express.Router();

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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check storage limits before creating user (~500 bytes)
    await limits.checkBeforeCreate('User', 500);

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

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Check storage limits before creating token (~200 bytes)
    await limits.checkBeforeCreate('RefreshToken', 200);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt
      }
    });

    // Log audit entry (check limits first)
    await limits.checkBeforeCreate('AuditLog', 300);
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

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

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Check storage limits before creating token (~200 bytes)
    await limits.checkBeforeCreate('RefreshToken', 200);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt
      }
    });

    // Log audit entry (check limits first)
    await limits.checkBeforeCreate('AuditLog', 300);
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

    // Check if token exists in database and not expired
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }

    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(tokenRecord.user);

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { token: refreshToken }
    });

    // Store new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Check storage limits before creating token (~200 bytes)
    await limits.checkBeforeCreate('RefreshToken', 200);

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

    // Log audit entry (check limits first)
    await limits.checkBeforeCreate('AuditLog', 300);
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
    const user = await prisma.user.findUnique({
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
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
