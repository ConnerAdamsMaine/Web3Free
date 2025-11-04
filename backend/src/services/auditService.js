/**
 * Audit Service
 *
 * COMPLIANCE:
 * - Complete audit trail for all operations
 * - GDPR compliance (data tracking and deletion)
 * - Security monitoring
 * - Regulatory requirements
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Log audit event
 * @param {Object} data - Audit data
 * @returns {Promise<Object>} Audit log entry
 */
const log = async (data) => {
  try {
    const {
      userId,
      walletAddress,
      ipAddress,
      userAgent,
      actionType,
      resourceType,
      resourceId,
      actionStatus,
      description,
      requestData,
      responseData,
      errorMessage,
      metadata,
    } = data;

    const result = await db.query(
      `INSERT INTO audit_logs (
        user_id, wallet_address, ip_address, user_agent,
        action_type, resource_type, resource_id, action_status,
        description, request_data, response_data, error_message, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        userId || null,
        walletAddress || null,
        ipAddress || null,
        userAgent || null,
        actionType,
        resourceType || null,
        resourceId || null,
        actionStatus,
        description,
        requestData ? JSON.stringify(requestData) : '{}',
        responseData ? JSON.stringify(responseData) : '{}',
        errorMessage || null,
        metadata ? JSON.stringify(metadata) : '{}',
      ]
    );

    return result.rows[0];
  } catch (error) {
    // Don't throw - audit logging should not break the application
    logger.error('Audit logging error:', error.message);
    return null;
  }
};

/**
 * Get audit logs for a user
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Audit logs
 */
const getUserAuditLogs = async (userId, filters = {}) => {
  try {
    const { page = 1, limit = 50, actionType, startDate, endDate } = filters;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM audit_logs WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (actionType) {
      paramCount++;
      query += ` AND action_type = $${paramCount}`;
      params.push(actionType);
    }

    if (startDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return result.rows;
  } catch (error) {
    logger.error('Get user audit logs error:', error.message);
    throw error;
  }
};

/**
 * Get audit logs for a resource
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @returns {Promise<Array>} Audit logs
 */
const getResourceAuditLogs = async (resourceType, resourceId) => {
  try {
    const result = await db.query(
      'SELECT * FROM audit_logs WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC',
      [resourceType, resourceId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Get resource audit logs error:', error.message);
    throw error;
  }
};

/**
 * Delete user audit logs (GDPR compliance)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of deleted logs
 */
const deleteUserAuditLogs = async (userId) => {
  try {
    const result = await db.query(
      'DELETE FROM audit_logs WHERE user_id = $1',
      [userId]
    );

    logger.info('User audit logs deleted:', { userId, count: result.rowCount });

    return result.rowCount;
  } catch (error) {
    logger.error('Delete user audit logs error:', error.message);
    throw error;
  }
};

module.exports = {
  log,
  getUserAuditLogs,
  getResourceAuditLogs,
  deleteUserAuditLogs,
};
