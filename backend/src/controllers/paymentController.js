const { asyncHandler, AppError } = require('../middleware/errorHandler');
const stripeService = require('../services/stripeService');
const logger = require('../utils/logger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createCheckout = asyncHandler(async (req, res) => {
  const { domainId } = req.body;
  const result = await stripeService.createCheckoutSession({
    domainId,
    userId: req.user.id,
    walletAddress: req.user.walletAddress,
    successUrl: `${process.env.FRONTEND_URL}/dashboard?payment=success`,
    cancelUrl: `${process.env.FRONTEND_URL}/dashboard?payment=canceled`,
  });
  res.json({ success: true, data: result });
});

const createPaymentIntent = asyncHandler(async (req, res) => {
  const { domainId, amount, currency } = req.body;
  const result = await stripeService.createPaymentIntent({
    domainId,
    userId: req.user.id,
    walletAddress: req.user.walletAddress,
    amount,
    currency,
  });
  res.json({ success: true, data: result });
});

const handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    throw new AppError('Webhook signature verification failed', 400);
  }

  await stripeService.handleWebhook(event);
  res.json({ received: true });
});

const getUserPayments = asyncHandler(async (req, res) => {
  const result = await stripeService.getUserPayments(req.user.id);
  res.json({ success: true, data: result });
});

const getPaymentById = asyncHandler(async (req, res) => {
  const result = await stripeService.getPaymentById(req.params.id);
  res.json({ success: true, data: result });
});

module.exports = {
  createCheckout,
  createPaymentIntent,
  handleWebhook,
  getUserPayments,
  getPaymentById,
};
