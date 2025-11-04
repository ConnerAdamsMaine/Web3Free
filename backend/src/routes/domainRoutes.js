const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domainController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { registrationLimiter } = require('../middleware/rateLimiter');

router.get('/search', domainController.searchDomain);
router.get('/resolve/:domain', optionalAuth, domainController.resolveDomain);
router.get('/eligibility/:walletAddress', domainController.checkEligibility);
router.get('/my-domains', authenticate, domainController.getUserDomains);
router.get('/:id', authenticate, domainController.getDomainById);
router.post('/register', authenticate, registrationLimiter, domainController.registerDomain);
router.patch('/:id/content', authenticate, domainController.updateContentHash);
router.post('/:id/transfer', authenticate, domainController.transferDomain);

module.exports = router;
