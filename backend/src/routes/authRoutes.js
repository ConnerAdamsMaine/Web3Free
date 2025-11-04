const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.get('/nonce/:walletAddress', authController.getNonce);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refreshTokenHandler);
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
