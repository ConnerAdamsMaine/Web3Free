/**
 * Authentication Middleware
 *
 * SECURITY:
 * - Web3 wallet signature authentication
 * - JWT token validation
 * - Session management
 * - Replay attack prevention (nonce)
 *
 * COMPLIANCE:
 * - Audit logging for all authentication attempts
 * - Failed login tracking
 */

const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const db = require('../config/database');
const logger = require('../utils/logger');
const { validateSignature } = require('../utils/validators');

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
};

/**
 * Generate refresh token
 * @param {Object} payload - Token payload
 * @returns {string} Refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate random nonce for signature verification
 * @returns {string} Random nonce
 */
const generateNonce = () => {
  return ethers.hexlify(ethers.randomBytes(32));
};

/**
 * Create authentication message for signing
 * @param {string} walletAddress - Wallet address
 * @param {string} nonce - Random nonce
 * @returns {string} Message to sign
 */
const createAuthMessage = (walletAddress, nonce) => {
  return `Sign this message to authenticate with Web3 Domain Registry.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
};

/**
 * Authentication middleware - verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided',
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = verifyToken(token);

    // Check if session exists and is active
    const sessionResult = await db.query(
      'SELECT s.*, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = $1 AND s.is_active = true AND s.expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid',
      });
    }

    const session = sessionResult.rows[0];

    // Update last activity
    await db.query(
      'UPDATE sessions SET last_activity = NOW() WHERE id = $1',
      [session.id]
    );

    // Attach user to request
    req.user = {
      id: session.user_id,
      walletAddress: session.wallet_address,
      email: session.email,
      isActive: session.is_active,
      kycStatus: session.kyc_status,
    };

    req.session = {
      id: session.id,
      token,
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error.message);

    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication - attach user if token is valid
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const sessionResult = await db.query(
      'SELECT s.*, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = $1 AND s.is_active = true AND s.expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length > 0) {
      const session = sessionResult.rows[0];

      req.user = {
        id: session.user_id,
        walletAddress: session.wallet_address,
        email: session.email,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Require admin role
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Check if user has admin role (implement role system)
    const adminResult = await db.query(
      'SELECT metadata->>\'role\' as role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (adminResult.rows.length === 0 || adminResult.rows[0].role !== 'admin') {
      logger.warn('Unauthorized admin access attempt:', req.user.walletAddress);

      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    next();
  } catch (error) {
    logger.error('Admin authorization error:', error.message);

    return res.status(403).json({
      success: false,
      error: 'Authorization failed',
    });
  }
};

/**
 * Require KYC verification
 */
const requireKYC = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (req.user.kycStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'KYC verification required',
        kycStatus: req.user.kycStatus,
      });
    }

    next();
  } catch (error) {
    logger.error('KYC check error:', error.message);

    return res.status(403).json({
      success: false,
      error: 'KYC verification failed',
    });
  }
};

/**
 * Verify wallet ownership (signature check)
 */
const verifyWalletOwnership = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    // Verify signature
    const isValid = await validateSignature(message, signature, walletAddress);

    if (!isValid) {
      logger.warn('Invalid signature for wallet:', walletAddress);

      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Attach wallet address to request
    req.verifiedWallet = walletAddress;

    next();
  } catch (error) {
    logger.error('Wallet verification error:', error.message);

    return res.status(401).json({
      success: false,
      error: 'Wallet verification failed',
    });
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  generateNonce,
  createAuthMessage,
  authenticate,
  optionalAuth,
  requireAdmin,
  requireKYC,
  verifyWalletOwnership,
};
