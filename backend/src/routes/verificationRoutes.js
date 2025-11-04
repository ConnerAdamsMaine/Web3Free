const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { verificationLimiter } = require('../middleware/rateLimiter');

router.post('/submit', authenticate, verificationLimiter, verificationController.submitVerification);
router.get('/my-verifications', authenticate, verificationController.getUserVerifications);
router.get('/pending', authenticate, requireAdmin, verificationController.getPendingVerifications);
router.get('/:id', authenticate, verificationController.getVerificationById);
router.post('/:id/review', authenticate, requireAdmin, verificationController.reviewVerification);

module.exports = router;
