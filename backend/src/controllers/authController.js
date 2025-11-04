/**
 * Authentication Controller
 * Handles Web3 wallet authentication
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { generateToken, generateRefreshToken, generateNonce, createAuthMessage, verifyToken } = require('../middleware/auth');
const { validateSignature, userRegistrationSchema } = require('../utils/validators');
const auditService = require('../services/auditService');

/**
 * Get authentication nonce
 * @route GET /api/auth/nonce/:walletAddress
 */
const getNonce = asyncHandler(async (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress) {
    throw new AppError('Wallet address is required', 400);
  }

  // Generate nonce
  const nonce = generateNonce();

  // Create message to sign
  const message = createAuthMessage(walletAddress, nonce);

  // Store nonce temporarily (expires in 5 minutes)
  // In production, use Redis for better performance
  await db.query(
    `INSERT INTO sessions (user_id, wallet_address, nonce, message, session_token, expires_at, is_active)
     VALUES (
       (SELECT id FROM users WHERE wallet_address = $1),
       $1, $2, $3, $2, NOW() + interval '5 minutes', false
     )
     ON CONFLICT DO NOTHING`,
    [walletAddress, nonce, message]
  );

  res.json({
    success: true,
    nonce,
    message,
    expiresIn: 300, // 5 minutes
  });
});

/**
 * Login with wallet signature
 * @route POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { walletAddress, signature, message, nonce } = req.body;

  // Validate request
  const { error } = userRegistrationSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  // Verify signature
  const isValid = await validateSignature(message, signature, walletAddress);

  if (!isValid) {
    await auditService.log({
      walletAddress,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      actionType: 'login_failed',
      actionStatus: 'failure',
      description: 'Invalid signature',
    });

    throw new AppError('Invalid signature', 401);
  }

  // Check if user exists
  let userResult = await db.query(
    'SELECT * FROM users WHERE wallet_address = $1',
    [walletAddress]
  );

  let user;

  if (userResult.rows.length === 0) {
    // Create new user
    const createResult = await db.query(
      'INSERT INTO users (wallet_address) VALUES ($1) RETURNING *',
      [walletAddress]
    );
    user = createResult.rows[0];
  } else {
    user = userResult.rows[0];

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
  }

  // Generate tokens
  const token = generateToken({ userId: user.id, walletAddress: user.wallet_address });
  const refreshToken = generateRefreshToken({ userId: user.id });

  // Create session
  await db.query(
    `INSERT INTO sessions (
      user_id, wallet_address, session_token, refresh_token,
      signature, message, nonce, ip_address, user_agent, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + interval '24 hours')`,
    [
      user.id,
      walletAddress,
      token,
      refreshToken,
      signature,
      message,
      nonce,
      req.ip,
      req.get('user-agent'),
    ]
  );

  // Log successful login
  await auditService.log({
    userId: user.id,
    walletAddress,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    actionType: 'login_success',
    actionStatus: 'success',
    description: 'User logged in successfully',
  });

  logger.info('User logged in:', { userId: user.id, walletAddress });

  res.json({
    success: true,
    token,
    refreshToken,
    user: {
      id: user.id,
      walletAddress: user.wallet_address,
      email: user.email,
      kycStatus: user.kyc_status,
      createdAt: user.created_at,
    },
  });
});

/**
 * Logout
 * @route POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const token = req.session?.token;

  if (token) {
    // Deactivate session
    await db.query(
      'UPDATE sessions SET is_active = false WHERE session_token = $1',
      [token]
    );

    await auditService.log({
      userId: req.user.id,
      walletAddress: req.user.walletAddress,
      actionType: 'logout',
      actionStatus: 'success',
      description: 'User logged out',
    });
  }

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * Refresh token
 * @route POST /api/auth/refresh
 */
const refreshTokenHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  // Verify refresh token
  const decoded = verifyToken(refreshToken);

  // Check if session exists
  const sessionResult = await db.query(
    'SELECT * FROM sessions WHERE refresh_token = $1 AND is_active = true',
    [refreshToken]
  );

  if (sessionResult.rows.length === 0) {
    throw new AppError('Invalid refresh token', 401);
  }

  const session = sessionResult.rows[0];

  // Generate new tokens
  const newToken = generateToken({ userId: session.user_id, walletAddress: session.wallet_address });
  const newRefreshToken = generateRefreshToken({ userId: session.user_id });

  // Update session
  await db.query(
    'UPDATE sessions SET session_token = $1, refresh_token = $2, expires_at = NOW() + interval \'24 hours\' WHERE id = $3',
    [newToken, newRefreshToken, session.id]
  );

  res.json({
    success: true,
    token: newToken,
    refreshToken: newRefreshToken,
  });
});

/**
 * Get current user
 * @route GET /api/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const userResult = await db.query(
    'SELECT id, wallet_address, email, email_verified, kyc_status, created_at, last_login FROM users WHERE id = $1',
    [req.user.id]
  );

  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    user: userResult.rows[0],
  });
});

module.exports = {
  getNonce,
  login,
  logout,
  refreshTokenHandler,
  getCurrentUser,
};
