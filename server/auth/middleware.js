const { verifyAccessToken } = require('./jwt');

/**
 * Authentication middleware - Verifies JWT access token
 * Attaches user data to req.user if valid
 */
function requireAuth(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user data to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication - Attaches user if token is valid, but doesn't reject if missing
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);

      if (decoded) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role
        };
      }
    }

    next();
  } catch (error) {
    // Don't fail the request, just continue without user data
    next();
  }
}

/**
 * Role-based authorization middleware
 * Usage: requireRole('admin') or requireRole(['admin', 'moderator'])
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole
};
