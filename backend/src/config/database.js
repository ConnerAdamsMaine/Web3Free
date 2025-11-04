/**
 * Database Configuration and Connection Pool
 *
 * SECURITY:
 * - SSL/TLS encryption for database connections in production
 * - Connection pooling for performance and resource management
 * - Prepared statements to prevent SQL injection
 *
 * COMPLIANCE:
 * - Connection logging for audit trails
 * - Timeout settings to prevent resource exhaustion
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'web3domains',
  user: process.env.DB_USER || 'web3domains_app',
  password: process.env.DB_PASSWORD,

  // Connection pool settings
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  max: parseInt(process.env.DB_POOL_MAX) || 10,

  // Connection timeouts
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,

  // SSL configuration (required for production)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false, // Set to true with proper certificates in production
  } : false,

  // Statement timeout (prevent long-running queries)
  statement_timeout: 10000,

  // Query timeout
  query_timeout: 10000,
};

// Create connection pool
const pool = new Pool(config);

// Pool event handlers
pool.on('connect', (client) => {
  logger.debug('New database client connected');
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected database pool error:', err);
});

pool.on('remove', (client) => {
  logger.debug('Client removed from pool');
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    return false;
  }
};

/**
 * Query helper with error handling and logging
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow query detected:', {
        duration: `${duration}ms`,
        query: text.substring(0, 100), // Log first 100 chars
        rowCount: result.rowCount,
      });
    }

    logger.debug('Query executed:', {
      duration: `${duration}ms`,
      rowCount: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error('Database query error:', {
      error: error.message,
      query: text.substring(0, 100),
    });
    throw error;
  }
};

/**
 * Transaction helper
 * @param {Function} callback - Async function to execute in transaction
 * @returns {Promise<*>} Transaction result
 */
const transaction = async (callback) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Graceful shutdown
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool:', error.message);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closePool,
};
