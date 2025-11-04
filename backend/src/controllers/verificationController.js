const { asyncHandler } = require('../middleware/errorHandler');
const verificationService = require('../services/verificationService');
const { profitVerificationSchema } = require('../utils/validators');

const submitVerification = asyncHandler(async (req, res) => {
  const { error } = profitVerificationSchema.validate(req.body);
  if (error) throw new Error(error.details[0].message);

  const result = await verificationService.submitVerification({
    ...req.body,
    userId: req.user.id,
  });

  res.status(201).json({ success: true, data: result });
});

const getUserVerifications = asyncHandler(async (req, res) => {
  const result = await verificationService.getUserVerifications(req.user.id);
  res.json({ success: true, data: result });
});

const getVerificationById = asyncHandler(async (req, res) => {
  const result = await verificationService.getVerificationById(req.params.id);
  res.json({ success: true, data: result });
});

const reviewVerification = asyncHandler(async (req, res) => {
  const { approved, reviewNotes } = req.body;
  const result = await verificationService.reviewVerification(req.params.id, {
    reviewerId: req.user.id,
    approved,
    reviewNotes,
  });
  res.json({ success: true, data: result });
});

const getPendingVerifications = asyncHandler(async (req, res) => {
  const result = await verificationService.getPendingVerifications();
  res.json({ success: true, data: result });
});

module.exports = {
  submitVerification,
  getUserVerifications,
  getVerificationById,
  reviewVerification,
  getPendingVerifications,
};
