/**
 * Profit Verification Service
 *
 * BUSINESS LOGIC:
 * - First domain per wallet is free (no verification needed)
 * - Additional domains require proof of business profit > threshold X
 * - Verification methods: income statement, Stripe Atlas, accounting APIs, manual review
 *
 * COMPLIANCE:
 * - Financial data encrypted
 * - GDPR-compliant data handling
 * - Manual review fallback for edge cases
 * - KYC/AML compliance
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const stripeService = require('./stripeService');
const auditService = require('./auditService');

/**
 * Submit profit verification request
 * @param {Object} data - Verification data
 * @returns {Promise<Object>} Verification request
 */
const submitVerification = async (data) => {
  const {
    userId,
    domainId,
    verificationType,
    reportedRevenue,
    reportedProfit,
    reportingPeriodStart,
    reportingPeriodEnd,
    currency,
    stripeAccountId,
    documents,
  } = data;

  try {
    // Check profit threshold
    const profitThreshold = parseFloat(process.env.PROFIT_THRESHOLD) || 10000;

    if (reportedProfit < profitThreshold) {
      throw new AppError(
        `Business profit must exceed ${currency} ${profitThreshold} to register additional domains`,
        400
      );
    }

    // Validate reporting period
    if (new Date(reportingPeriodStart) >= new Date(reportingPeriodEnd)) {
      throw new AppError('Invalid reporting period', 400);
    }

    // Create verification request
    const result = await db.query(
      `INSERT INTO profit_verifications (
        user_id, domain_id, verification_type,
        reported_revenue, reported_profit, reporting_period_start, reporting_period_end, currency,
        stripe_account_id, document_urls, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        userId,
        domainId || null,
        verificationType,
        reportedRevenue || null,
        reportedProfit,
        reportingPeriodStart,
        reportingPeriodEnd,
        currency || 'USD',
        stripeAccountId || null,
        documents ? JSON.stringify(documents) : '[]',
        'pending',
      ]
    );

    const verification = result.rows[0];

    // Automated verification for Stripe Atlas
    if (verificationType === 'stripe_atlas' && stripeAccountId) {
      const autoVerify = process.env.AUTO_APPROVE_STRIPE_ATLAS === 'true';

      if (autoVerify) {
        try {
          const stripeVerification = await stripeService.verifyStripeAtlasAccount(stripeAccountId);

          if (stripeVerification.verified) {
            // Auto-approve
            await db.query(
              `UPDATE profit_verifications
               SET status = 'approved',
                   automated_check_passed = true,
                   automated_check_details = $1,
                   approved_at = NOW()
               WHERE id = $2`,
              [JSON.stringify(stripeVerification), verification.id]
            );

            logger.info('Profit verification auto-approved via Stripe Atlas:', {
              verificationId: verification.id,
              userId,
            });

            verification.status = 'approved';
            verification.automated_check_passed = true;
          }
        } catch (error) {
          logger.error('Stripe Atlas auto-verification failed:', error.message);
          // Continue with manual review
        }
      }
    }

    // Log audit
    await auditService.log({
      userId,
      actionType: 'verification_submitted',
      resourceType: 'verification',
      resourceId: verification.id,
      actionStatus: 'success',
      description: `Profit verification submitted: ${verificationType}`,
      metadata: { verificationType, reportedProfit, currency },
    });

    logger.info('Profit verification submitted:', {
      verificationId: verification.id,
      userId,
      type: verificationType,
    });

    return verification;
  } catch (error) {
    logger.error('Submit verification error:', error.message);
    throw error;
  }
};

/**
 * Review verification request (admin/manual review)
 * @param {string} verificationId - Verification ID
 * @param {Object} reviewData - Review data
 * @returns {Promise<Object>} Updated verification
 */
const reviewVerification = async (verificationId, reviewData) => {
  const { reviewerId, approved, reviewNotes } = reviewData;

  try {
    const status = approved ? 'approved' : 'rejected';

    const result = await db.query(
      `UPDATE profit_verifications
       SET status = $1,
           reviewed_by = $2,
           review_notes = $3,
           reviewed_at = NOW(),
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END
       WHERE id = $4
       RETURNING *`,
      [status, reviewerId, reviewNotes, verificationId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Verification request not found', 404);
    }

    const verification = result.rows[0];

    // If approved, activate associated domain
    if (approved && verification.domain_id) {
      await db.query(
        `UPDATE domains
         SET verification_status = 'approved', verified_at = NOW()
         WHERE id = $1`,
        [verification.domain_id]
      );

      logger.info('Domain verification approved:', {
        domainId: verification.domain_id,
        verificationId,
      });
    }

    // Log audit
    await auditService.log({
      userId: reviewerId,
      actionType: 'verification_reviewed',
      resourceType: 'verification',
      resourceId: verificationId,
      actionStatus: 'success',
      description: `Profit verification ${status}`,
      metadata: { approved, reviewNotes },
    });

    logger.info('Profit verification reviewed:', {
      verificationId,
      status,
      reviewerId,
    });

    return verification;
  } catch (error) {
    logger.error('Review verification error:', error.message);
    throw error;
  }
};

/**
 * Get verification by ID
 * @param {string} verificationId - Verification ID
 * @returns {Promise<Object>} Verification
 */
const getVerificationById = async (verificationId) => {
  try {
    const result = await db.query(
      `SELECT pv.*, u.wallet_address, u.email, d.full_domain
       FROM profit_verifications pv
       LEFT JOIN users u ON pv.user_id = u.id
       LEFT JOIN domains d ON pv.domain_id = d.id
       WHERE pv.id = $1`,
      [verificationId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Verification request not found', 404);
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Get verification error:', error.message);
    throw error;
  }
};

/**
 * Get user verifications
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Verifications
 */
const getUserVerifications = async (userId) => {
  try {
    const result = await db.query(
      `SELECT pv.*, d.full_domain
       FROM profit_verifications pv
       LEFT JOIN domains d ON pv.domain_id = d.id
       WHERE pv.user_id = $1
       ORDER BY pv.submitted_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Get user verifications error:', error.message);
    throw error;
  }
};

/**
 * Get pending verifications (admin)
 * @returns {Promise<Array>} Pending verifications
 */
const getPendingVerifications = async () => {
  try {
    const result = await db.query(
      `SELECT pv.*, u.wallet_address, u.email, d.full_domain
       FROM profit_verifications pv
       LEFT JOIN users u ON pv.user_id = u.id
       LEFT JOIN domains d ON pv.domain_id = d.id
       WHERE pv.status IN ('pending', 'under_review')
       ORDER BY pv.submitted_at ASC`
    );

    return result.rows;
  } catch (error) {
    logger.error('Get pending verifications error:', error.message);
    throw error;
  }
};

/**
 * Request additional information
 * @param {string} verificationId - Verification ID
 * @param {string} message - Message to user
 * @returns {Promise<Object>} Updated verification
 */
const requestAdditionalInfo = async (verificationId, message) => {
  try {
    const result = await db.query(
      `UPDATE profit_verifications
       SET status = 'additional_info_needed',
           review_notes = $1,
           reviewed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [message, verificationId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Verification request not found', 404);
    }

    logger.info('Additional information requested:', {
      verificationId,
      message,
    });

    // TODO: Send notification to user

    return result.rows[0];
  } catch (error) {
    logger.error('Request additional info error:', error.message);
    throw error;
  }
};

/**
 * Check if user has approved verification
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user has approved verification
 */
const hasApprovedVerification = async (userId) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM profit_verifications
       WHERE user_id = $1 AND status = 'approved'`,
      [userId]
    );

    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logger.error('Check approved verification error:', error.message);
    throw error;
  }
};

module.exports = {
  submitVerification,
  reviewVerification,
  getVerificationById,
  getUserVerifications,
  getPendingVerifications,
  requestAdditionalInfo,
  hasApprovedVerification,
};
