const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Default expiries - can be overridden by system settings
// Access token: 24 hours default (will auto-refresh)
// Refresh token: 365 days for long-running NOC displays
const DEFAULT_ACCESS_EXPIRY = '24h';
const DEFAULT_REFRESH_EXPIRY = '365d';

// Validate JWT secrets are set
if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  console.error('❌ ERROR: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env file');
  console.error('   Generate them with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

/**
 * Generate access token
 * Default: 24 hours, but will auto-refresh before expiry
 */
function generateAccessToken(payload, expiresIn = DEFAULT_ACCESS_EXPIRY) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn });
}

/**
 * Generate refresh token (long-lived for NOC displays)
 * Default: 365 days to support always-on dashboards
 * Includes a unique jti (JWT ID) to ensure each token is unique
 */
function generateRefreshToken(payload, expiresIn = DEFAULT_REFRESH_EXPIRY) {
  const payloadWithJti = {
    ...payload,
    jti: crypto.randomUUID()
  };
  return jwt.sign(payloadWithJti, JWT_REFRESH_SECRET, { expiresIn });
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Generate both access and refresh tokens
 */
function generateTokenPair(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair
};
