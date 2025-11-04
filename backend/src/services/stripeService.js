/**
 * Stripe Payment Service
 *
 * COMPLIANCE:
 * - PCI DSS compliant (no card data stored)
 * - Payment verification and tracking
 * - Webhook signature verification
 * - Stripe Atlas integration for business verification
 *
 * SECURITY:
 * - Secure API key management
 * - Webhook signature validation
 * - Amount validation
 * - Idempotency keys
 */

const Stripe = require('stripe');
const db = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

/**
 * Create payment intent for domain registration
 * @param {Object} data - Payment data
 * @returns {Promise<Object>} Payment intent
 */
const createPaymentIntent = async (data) => {
  const { domainId, userId, walletAddress, amount, currency = 'usd' } = data;

  try {
    // Get domain info
    const domainResult = await db.query(
      'SELECT * FROM domains WHERE id = $1 AND user_id = $2',
      [domainId, userId]
    );

    if (domainResult.rows.length === 0) {
      throw new AppError('Domain not found', 404);
    }

    const domain = domainResult.rows[0];

    if (domain.is_active && !domain.is_paid) {
      throw new AppError('Free domain does not require payment', 400);
    }

    // Calculate amount (convert to cents for Stripe)
    const amountInCents = Math.round(parseFloat(amount) * 100);

    if (amountInCents < 50) {
      throw new AppError('Amount too small (minimum $0.50)', 400);
    }

    // Create or get Stripe customer
    let customerId = null;

    const userResult = await db.query(
      'SELECT metadata FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows[0]?.metadata?.stripe_customer_id) {
      customerId = userResult.rows[0].metadata.stripe_customer_id;
    } else {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          userId,
          walletAddress,
        },
      });

      customerId = customer.id;

      // Store customer ID
      await db.query(
        'UPDATE users SET metadata = metadata || $1 WHERE id = $2',
        [JSON.stringify({ stripe_customer_id: customerId }), userId]
      );
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customerId,
      metadata: {
        domainId,
        userId,
        walletAddress,
        domain: domain.full_domain,
      },
      description: `Domain registration: ${domain.full_domain}`,
      statement_descriptor: 'Web3 Domain Reg',
    });

    // Store payment record
    await db.query(
      `INSERT INTO payments (
        user_id, domain_id, provider, provider_payment_id, provider_customer_id,
        amount, currency, status, payment_method_type, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        userId,
        domainId,
        'stripe',
        paymentIntent.id,
        customerId,
        amount,
        currency,
        'pending',
        'card',
        `Payment for domain: ${domain.full_domain}`,
        JSON.stringify({ paymentIntent: paymentIntent.id }),
      ]
    );

    // Log audit
    await auditService.log({
      userId,
      walletAddress,
      actionType: 'payment_created',
      resourceType: 'payment',
      resourceId: paymentIntent.id,
      actionStatus: 'success',
      description: `Payment intent created for domain: ${domain.full_domain}`,
      metadata: { amount: amountInCents, currency },
    });

    logger.info('Payment intent created:', {
      paymentIntentId: paymentIntent.id,
      domain: domain.full_domain,
      amount: amountInCents,
    });

    return {
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amountInCents,
        currency,
        status: paymentIntent.status,
      },
      domain: {
        id: domain.id,
        name: domain.full_domain,
      },
    };
  } catch (error) {
    logger.error('Create payment intent error:', error.message);
    throw error;
  }
};

/**
 * Create checkout session for domain registration
 * @param {Object} data - Checkout data
 * @returns {Promise<Object>} Checkout session
 */
const createCheckoutSession = async (data) => {
  const { domainId, userId, walletAddress, successUrl, cancelUrl } = data;

  try {
    // Get domain info
    const domainResult = await db.query(
      'SELECT * FROM domains WHERE id = $1 AND user_id = $2',
      [domainId, userId]
    );

    if (domainResult.rows.length === 0) {
      throw new AppError('Domain not found', 404);
    }

    const domain = domainResult.rows[0];

    // Get registration fee from environment
    const registrationFee = parseFloat(process.env.DOMAIN_REGISTRATION_FEE) || 9.99;
    const currency = (process.env.CURRENCY || 'usd').toLowerCase();

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: domain.email || undefined,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: Math.round(registrationFee * 100),
            product_data: {
              name: `Domain Registration: ${domain.full_domain}`,
              description: `Register ${domain.full_domain} as a self-hosted domain with verification`,
              images: ['https://web3domains.com/images/domain-icon.png'],
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        domainId,
        userId,
        walletAddress,
        domain: domain.full_domain,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Store payment record
    await db.query(
      `INSERT INTO payments (
        user_id, domain_id, provider, provider_payment_id,
        amount, currency, status, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        domainId,
        'stripe',
        session.id,
        registrationFee,
        currency,
        'pending',
        `Checkout session for domain: ${domain.full_domain}`,
        JSON.stringify({ sessionId: session.id }),
      ]
    );

    logger.info('Checkout session created:', {
      sessionId: session.id,
      domain: domain.full_domain,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    logger.error('Create checkout session error:', error.message);
    throw error;
  }
};

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe event
 * @returns {Promise<void>}
 */
const handleWebhook = async (event) => {
  try {
    logger.info('Processing Stripe webhook:', { type: event.type, id: event.id });

    // Store webhook event
    await db.query(
      `INSERT INTO webhook_events (provider, event_id, event_type, payload, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (provider, event_id) DO NOTHING`,
      ['stripe', event.id, event.type, JSON.stringify(event.data), 'pending']
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.created':
        // Customer created - no action needed
        break;

      default:
        logger.info('Unhandled webhook event type:', event.type);
    }

    // Mark webhook as processed
    await db.query(
      `UPDATE webhook_events SET status = 'processed', processed_at = NOW()
       WHERE event_id = $1 AND provider = 'stripe'`,
      [event.id]
    );
  } catch (error) {
    logger.error('Webhook handling error:', error.message);

    // Mark webhook as failed
    await db.query(
      `UPDATE webhook_events
       SET status = 'failed', error_message = $1
       WHERE event_id = $2 AND provider = 'stripe'`,
      [error.message, event.id]
    );

    throw error;
  }
};

/**
 * Handle successful payment intent
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    const { id: paymentIntentId, metadata } = paymentIntent;
    const { domainId, userId, walletAddress } = metadata;

    // Update payment status
    const paymentResult = await db.query(
      `UPDATE payments
       SET status = 'succeeded', paid_at = NOW()
       WHERE provider_payment_id = $1
       RETURNING *`,
      [paymentIntentId]
    );

    if (paymentResult.rows.length === 0) {
      logger.warn('Payment record not found for payment intent:', paymentIntentId);
      return;
    }

    // Activate domain (paid domain, self-hosted)
    await db.query(
      `UPDATE domains
       SET is_active = true, verification_status = 'approved', verified_at = NOW()
       WHERE id = $1`,
      [domainId]
    );

    // Log audit
    await auditService.log({
      userId,
      walletAddress,
      actionType: 'payment_succeeded',
      resourceType: 'payment',
      resourceId: paymentIntentId,
      actionStatus: 'success',
      description: `Payment successful for domain: ${metadata.domain}`,
    });

    logger.info('Payment succeeded and domain activated:', {
      paymentIntentId,
      domain: metadata.domain,
    });

    // TODO: Send notification to user
    // TODO: Confirm registration on blockchain if needed
  } catch (error) {
    logger.error('Handle payment success error:', error.message);
    throw error;
  }
};

/**
 * Handle failed payment intent
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const { id: paymentIntentId, metadata } = paymentIntent;

    // Update payment status
    await db.query(
      `UPDATE payments
       SET status = 'failed'
       WHERE provider_payment_id = $1`,
      [paymentIntentId]
    );

    // Log audit
    await auditService.log({
      userId: metadata.userId,
      walletAddress: metadata.walletAddress,
      actionType: 'payment_failed',
      resourceType: 'payment',
      resourceId: paymentIntentId,
      actionStatus: 'failure',
      description: `Payment failed for domain: ${metadata.domain}`,
    });

    logger.warn('Payment failed:', {
      paymentIntentId,
      domain: metadata.domain,
    });

    // TODO: Send notification to user
  } catch (error) {
    logger.error('Handle payment failure error:', error.message);
    throw error;
  }
};

/**
 * Handle completed checkout session
 */
const handleCheckoutSessionCompleted = async (session) => {
  try {
    const { id: sessionId, metadata, payment_status } = session;
    const { domainId, userId, walletAddress, domain } = metadata;

    if (payment_status === 'paid') {
      // Update payment status
      await db.query(
        `UPDATE payments
         SET status = 'succeeded', paid_at = NOW()
         WHERE provider_payment_id = $1`,
        [sessionId]
      );

      // Activate domain
      await db.query(
        `UPDATE domains
         SET is_active = true, verification_status = 'approved', verified_at = NOW()
         WHERE id = $1`,
        [domainId]
      );

      // Log audit
      await auditService.log({
        userId,
        walletAddress,
        actionType: 'checkout_completed',
        resourceType: 'payment',
        resourceId: sessionId,
        actionStatus: 'success',
        description: `Checkout completed for domain: ${domain}`,
      });

      logger.info('Checkout completed and domain activated:', {
        sessionId,
        domain,
      });
    }
  } catch (error) {
    logger.error('Handle checkout completion error:', error.message);
    throw error;
  }
};

/**
 * Verify Stripe Atlas business (for profit verification)
 * @param {string} stripeAccountId - Stripe Connect account ID
 * @returns {Promise<Object>} Verification result
 */
const verifyStripeAtlasAccount = async (stripeAccountId) => {
  try {
    // Retrieve account details
    const account = await stripe.accounts.retrieve(stripeAccountId);

    // Check if account is verified
    const isVerified = account.charges_enabled && account.payouts_enabled;

    // Get revenue data if available (requires Stripe Atlas or Connect)
    // This is a simplified example - actual implementation depends on Stripe setup
    const verification = {
      accountId: stripeAccountId,
      verified: isVerified,
      businessType: account.business_type,
      country: account.country,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };

    logger.info('Stripe Atlas account verified:', verification);

    return verification;
  } catch (error) {
    logger.error('Stripe Atlas verification error:', error.message);
    throw error;
  }
};

/**
 * Get payment by ID
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Payment
 */
const getPaymentById = async (paymentId) => {
  try {
    const result = await db.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Get payment error:', error.message);
    throw error;
  }
};

/**
 * Get user payments
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Payments
 */
const getUserPayments = async (userId) => {
  try {
    const result = await db.query(
      `SELECT p.*, d.full_domain
       FROM payments p
       LEFT JOIN domains d ON p.domain_id = d.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Get user payments error:', error.message);
    throw error;
  }
};

module.exports = {
  createPaymentIntent,
  createCheckoutSession,
  handleWebhook,
  verifyStripeAtlasAccount,
  getPaymentById,
  getUserPayments,
};
