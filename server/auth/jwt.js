const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Generate access token (short-lived, 15 minutes)
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
}

/**
 * Generate refresh token (long-lived, 7 days)
 * Includes a unique jti (JWT ID) to ensure each token is unique
 */
function generateRefreshToken(payload) {
  const payloadWithJti = {
    ...payload,
    jti: crypto.randomUUID()
  };
  return jwt.sign(payloadWithJti, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
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
