/**
 * Rate Limiting Middleware
 *
 * SECURITY:
 * - Prevent brute force attacks
 * - Prevent DDoS attacks
 * - Prevent API abuse
 * - Track suspicious activity
 *
 * COMPLIANCE:
 * - Log rate limit violations
 * - Configurable limits per endpoint
 */

const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 * Applies to all API routes
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      retryAfter: req.rateLimit.resetTime,
    });
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === '/health';
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: async (req, res) => {
    // Log suspicious authentication activity
    logger.warn('Authentication rate limit exceeded:', {
      ip: req.ip,
      walletAddress: req.body?.walletAddress,
      userAgent: req.get('user-agent'),
    });

    // Store in rate_limits table for tracking
    try {
      await db.query(
        `INSERT INTO rate_limits (identifier, identifier_type, endpoint, request_count, window_start, window_end, is_blocked, block_reason)
         VALUES ($1, $2, $3, $4, NOW(), NOW() + interval '15 minutes', true, $5)
         ON CONFLICT (identifier, endpoint, window_start) DO UPDATE SET request_count = rate_limits.request_count + 1, is_blocked = true`,
        [req.ip, 'ip', req.path, 1, 'Rate limit exceeded - suspicious authentication activity']
      );
    } catch (error) {
      logger.error('Error storing rate limit violation:', error.message);
    }

    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again in 15 minutes',
    });
  },
});

/**
 * Registration rate limiter
 * Prevents domain registration spam
 */
const registrationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: parseInt(process.env.REGISTRATION_RATE_LIMIT) || 10, // 10 registrations per day
  message: {
    success: false,
    error: 'Too many domain registrations, please try again tomorrow',
  },
  keyGenerator: (req) => {
    // Rate limit by wallet address if authenticated
    if (req.user && req.user.walletAddress) {
      return req.user.walletAddress;
    }
    // Otherwise by IP
    return req.ip;
  },
  handler: (req, res) => {
    logger.warn('Registration rate limit exceeded:', {
      walletAddress: req.user?.walletAddress,
      ip: req.ip,
    });

    res.status(429).json({
      success: false,
      error: 'You have reached the daily domain registration limit',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Payment rate limiter
 * Prevents payment spam and fraud
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: {
    success: false,
    error: 'Too many payment attempts, please try again later',
  },
  keyGenerator: (req) => {
    return req.user?.walletAddress || req.ip;
  },
  handler: (req, res) => {
    logger.warn('Payment rate limit exceeded:', {
      walletAddress: req.user?.walletAddress,
      ip: req.ip,
    });

    res.status(429).json({
      success: false,
      error: 'Too many payment attempts, please try again later',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Verification submission rate limiter
 * Prevents spam submissions
 */
const verificationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 verification submissions per day
  message: {
    success: false,
    error: 'Too many verification submissions, please try again tomorrow',
  },
  keyGenerator: (req) => {
    return req.user?.walletAddress || req.ip;
  },
});

/**
 * Custom rate limiter using database
 * More sophisticated than in-memory rate limiting
 * Useful for distributed systems
 */
const databaseRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    maxRequests = 100,
    keyGenerator = (req) => req.ip,
    endpoint = 'default',
  } = options;

  return async (req, res, next) => {
    try {
      const identifier = keyGenerator(req);
      const windowStart = new Date(Date.now() - windowMs);

      // Check current rate limit
      const result = await db.query(
        `SELECT request_count, is_blocked, blocked_until
         FROM rate_limits
         WHERE identifier = $1
           AND endpoint = $2
           AND window_end > NOW()
         ORDER BY window_end DESC
         LIMIT 1`,
        [identifier, endpoint]
      );

      // Check if blocked
      if (result.rows.length > 0) {
        const record = result.rows[0];

        if (record.is_blocked && new Date(record.blocked_until) > new Date()) {
          logger.warn('Blocked request attempt:', {
            identifier,
            endpoint,
            blockedUntil: record.blocked_until,
          });

          return res.status(403).json({
            success: false,
            error: 'Your access has been temporarily blocked',
            unblockAt: record.blocked_until,
          });
        }

        // Check if limit exceeded
        if (record.request_count >= maxRequests) {
          logger.warn('Rate limit exceeded:', {
            identifier,
            endpoint,
            count: record.request_count,
          });

          // Block for 1 hour if repeatedly exceeding
          const blockUntil = new Date(Date.now() + 60 * 60 * 1000);

          await db.query(
            `UPDATE rate_limits
             SET is_blocked = true, blocked_until = $1, block_reason = $2
             WHERE identifier = $3 AND endpoint = $4 AND window_end > NOW()`,
            [blockUntil, 'Repeated rate limit violations', identifier, endpoint]
          );

          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Access blocked temporarily.',
            unblockAt: blockUntil,
          });
        }

        // Increment counter
        await db.query(
          `UPDATE rate_limits
           SET request_count = request_count + 1, updated_at = NOW()
           WHERE identifier = $1 AND endpoint = $2 AND window_end > NOW()`,
          [identifier, endpoint]
        );
      } else {
        // Create new rate limit record
        const windowEnd = new Date(Date.now() + windowMs);

        await db.query(
          `INSERT INTO rate_limits (identifier, identifier_type, endpoint, request_count, window_start, window_end)
           VALUES ($1, $2, $3, 1, NOW(), $4)`,
          [identifier, 'custom', endpoint, windowEnd]
        );
      }

      next();
    } catch (error) {
      logger.error('Database rate limiter error:', error.message);
      // Continue on error (fail open)
      next();
    }
  };
};

/**
 * Check if IP is blocked
 */
const checkIPBlock = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM rate_limits
       WHERE identifier = $1
         AND is_blocked = true
         AND blocked_until > NOW()
       LIMIT 1`,
      [req.ip]
    );

    if (result.rows.length > 0) {
      const block = result.rows[0];

      logger.warn('Blocked IP attempt:', {
        ip: req.ip,
        reason: block.block_reason,
        blockedUntil: block.blocked_until,
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        reason: 'Your IP has been temporarily blocked due to suspicious activity',
        unblockAt: block.blocked_until,
      });
    }

    next();
  } catch (error) {
    logger.error('IP block check error:', error.message);
    next();
  }
};

module.exports = {
  apiLimiter,
  authLimiter,
  registrationLimiter,
  paymentLimiter,
  verificationLimiter,
  databaseRateLimiter,
  checkIPBlock,
};
