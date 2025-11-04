const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.get('/dashboard', authenticate, userController.getDashboard);
router.patch('/profile', authenticate, userController.updateProfile);

module.exports = router;
