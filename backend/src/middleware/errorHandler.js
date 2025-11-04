/**
 * Error Handling Middleware
 *
 * SECURITY:
 * - Hide internal error details from clients in production
 * - Log all errors for monitoring
 * - Sanitize error messages
 *
 * COMPLIANCE:
 * - Error audit trail
 * - Alert on critical errors
 */

const logger = require('../utils/logger');

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found middleware
 */
const notFound = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error
  logger.error('Error occurred:', {
    message: error.message,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user?.walletAddress,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = 'Validation error';
    error = new AppError(message, 400);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401);
  }

  // PostgreSQL errors
  if (err.code && err.code.startsWith('23')) {
    // 23xxx are integrity constraint violations
    const message = 'Database constraint violation';
    error = new AppError(message, 400);
  }

  // Ethereum/Web3 errors
  if (err.code === 'INSUFFICIENT_FUNDS') {
    const message = 'Insufficient funds for transaction';
    error = new AppError(message, 400);
  }

  if (err.code === 'UNPREDICTABLE_GAS_LIMIT') {
    const message = 'Transaction may fail or require manual gas limit';
    error = new AppError(message, 400);
  }

  // Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    const message = 'Payment processing error';
    error = new AppError(message, 400);
    error.stripeError = err.type;
  }

  // Prepare response
  const response = {
    success: false,
    error: error.message || 'Internal server error',
    statusCode: error.statusCode,
    timestamp: error.timestamp || new Date().toISOString(),
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err;
  }

  // Add error code if available
  if (err.code) {
    response.code = err.code;
  }

  // Send error response
  res.status(error.statusCode).json(response);
};

/**
 * Async handler wrapper
 * Catches errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error formatter
 */
const formatValidationErrors = (errors) => {
  if (Array.isArray(errors)) {
    return errors.map((err) => ({
      field: err.path || err.param,
      message: err.message || err.msg,
      value: err.value,
    }));
  }

  return [{
    message: errors.message || 'Validation error',
  }];
};

module.exports = {
  AppError,
  notFound,
  errorHandler,
  asyncHandler,
  formatValidationErrors,
};
