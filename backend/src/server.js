/**
 * Web3 Domain Registry - Main Server
 *
 * SECURITY:
 * - Helmet for HTTP headers security
 * - CORS configuration
 * - Rate limiting
 * - Request validation
 * - Error handling
 *
 * COMPLIANCE:
 * - Audit logging
 * - GDPR compliance
 * - Data encryption
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const logger = require('./utils/logger');
const db = require('./config/database');
const blockchain = require('./config/blockchain');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter, checkIPBlock } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const domainRoutes = require('./routes/domainRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const userRoutes = require('./routes/userRoutes');

// Initialize express app
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Configure as needed
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression
app.use(compression());

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// IP block check
app.use(checkIPBlock);

// Rate limiting
app.use('/api/', apiLimiter);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbHealthy = await db.testConnection();

    // Check blockchain connection
    const blockchainHealthy = await blockchain.testConnection();

    const health = {
      status: dbHealthy && blockchainHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        blockchain: blockchainHealthy ? 'connected' : 'disconnected',
      },
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/users', userRoutes);

// API root
app.get('/api', (req, res) => {
  res.json({
    name: 'Web3 Domain Registry API',
    version: '1.0.0',
    description: 'Blockchain-based domain registration system with custom TLDs',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      domains: '/api/domains',
      payments: '/api/payments',
      verifications: '/api/verifications',
      users: '/api/users',
    },
    documentation: process.env.API_DOCS_URL || '/docs',
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, async () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 Web3 Domain Registry API Server`);
  logger.info('='.repeat(60));
  logger.info(`Environment:  ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Server:       http://${HOST}:${PORT}`);
  logger.info(`API:          http://${HOST}:${PORT}/api`);
  logger.info(`Health:       http://${HOST}:${PORT}/health`);
  logger.info('='.repeat(60));

  // Test connections
  try {
    const dbConnected = await db.testConnection();
    logger.info(`Database:     ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);

    const blockchainConnected = await blockchain.testConnection();
    logger.info(`Blockchain:   ${blockchainConnected ? '✅ Connected' : '❌ Disconnected'}`);

    if (blockchain.verifierWallet) {
      logger.info(`Verifier:     ${blockchain.verifierWallet.address}`);
    } else {
      logger.warn(`Verifier:     ⚠️  Not configured`);
    }

    logger.info('='.repeat(60));
    logger.info('✅ Server is ready to accept requests');
    logger.info('='.repeat(60));
  } catch (error) {
    logger.error('Server startup error:', error.message);
  }
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connections
      await db.closePool();
      logger.info('Database connections closed');

      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
