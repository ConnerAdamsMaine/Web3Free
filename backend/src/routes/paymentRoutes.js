const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');

router.post('/create-checkout', authenticate, paymentLimiter, paymentController.createCheckout);
router.post('/create-payment-intent', authenticate, paymentLimiter, paymentController.createPaymentIntent);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);
router.get('/my-payments', authenticate, paymentController.getUserPayments);
router.get('/:id', authenticate, paymentController.getPaymentById);

module.exports = router;
