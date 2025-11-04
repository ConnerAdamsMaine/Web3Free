const { asyncHandler } = require('../middleware/errorHandler');
const domainService = require('../services/domainService');
const { domainRegistrationSchema } = require('../utils/validators');

const searchDomain = asyncHandler(async (req, res) => {
  const { name, tld } = req.query;
  const result = await domainService.searchDomain(name, tld);
  res.json({ success: true, data: result });
});

const checkEligibility = asyncHandler(async (req, res) => {
  const { walletAddress } = req.params;
  const result = await domainService.checkFreeEligibility(walletAddress);
  res.json({ success: true, data: result });
});

const registerDomain = asyncHandler(async (req, res) => {
  const { error } = domainRegistrationSchema.validate(req.body);
  if (error) throw new Error(error.details[0].message);

  const result = await domainService.registerDomain({
    ...req.body,
    userId: req.user.id,
    hostingType: req.body.hostingType || 'centralized',
  });

  res.status(201).json({ success: true, data: result });
});

const resolveDomain = asyncHandler(async (req, res) => {
  const { domain } = req.params;
  const result = await domainService.resolveDomain(domain);
  res.json({ success: true, data: result });
});

const getUserDomains = asyncHandler(async (req, res) => {
  const result = await domainService.getUserDomains(req.user.id, req.query);
  res.json({ success: true, data: result });
});

const getDomainById = asyncHandler(async (req, res) => {
  const result = await domainService.getDomainById(req.params.id);
  res.json({ success: true, data: result });
});

const updateContentHash = asyncHandler(async (req, res) => {
  const { contentHash } = req.body;
  const result = await domainService.updateContentHash(req.params.id, contentHash, req.user.id);
  res.json({ success: true, data: result });
});

const transferDomain = asyncHandler(async (req, res) => {
  const { newOwnerWallet } = req.body;
  const result = await domainService.transferDomain(req.params.id, newOwnerWallet, req.user.id);
  res.json({ success: true, data: result });
});

module.exports = {
  searchDomain,
  checkEligibility,
  registerDomain,
  resolveDomain,
  getUserDomains,
  getDomainById,
  updateContentHash,
  transferDomain,
};
