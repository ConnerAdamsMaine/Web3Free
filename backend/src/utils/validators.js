/**
 * Input Validation Utilities
 *
 * SECURITY: All user inputs must be validated before processing
 * - Prevent SQL injection
 * - Prevent XSS attacks
 * - Prevent invalid data
 * - Enforce business rules
 */

const { ethers } = require('ethers');
const Joi = require('joi');

/**
 * Blocked TLDs (reserved by other systems)
 */
const BLOCKED_TLDS = [
  'eth', 'crypto', 'nft', 'x', 'wallet', 'bitcoin',
  'blockchain', 'hns', 'btc', 'id', 'stack', 'zil'
];

/**
 * Validate Ethereum wallet address
 * @param {string} address - Wallet address
 * @returns {boolean} True if valid
 */
const isValidWalletAddress = (address) => {
  return ethers.isAddress(address);
};

/**
 * Validate domain name format
 * @param {string} domainName - Domain name
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateDomainName = (domainName) => {
  // Length check
  if (!domainName || domainName.length < 3) {
    return { valid: false, error: 'Domain name must be at least 3 characters' };
  }

  if (domainName.length > 253) {
    return { valid: false, error: 'Domain name must be at most 253 characters' };
  }

  // Format check: alphanumeric and hyphens only
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

  if (!domainRegex.test(domainName)) {
    return {
      valid: false,
      error: 'Domain name can only contain letters, numbers, and hyphens (not at start/end)',
    };
  }

  // No consecutive hyphens
  if (domainName.includes('--')) {
    return { valid: false, error: 'Domain name cannot contain consecutive hyphens' };
  }

  return { valid: true };
};

/**
 * Validate TLD format
 * @param {string} tld - TLD
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateTLD = (tld) => {
  // Length check
  if (!tld || tld.length === 0) {
    return { valid: false, error: 'TLD is required' };
  }

  if (tld.length > 63) {
    return { valid: false, error: 'TLD must be at most 63 characters' };
  }

  // Format check: lowercase letters only
  const tldRegex = /^[a-z]+$/;

  if (!tldRegex.test(tld)) {
    return { valid: false, error: 'TLD can only contain lowercase letters' };
  }

  // Check if blocked
  if (BLOCKED_TLDS.includes(tld.toLowerCase())) {
    return { valid: false, error: `TLD ".${tld}" is reserved and cannot be used` };
  }

  return { valid: true };
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate domain registration request
 */
const domainRegistrationSchema = Joi.object({
  domainName: Joi.string()
    .min(3)
    .max(253)
    .pattern(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/)
    .required()
    .messages({
      'string.pattern.base': 'Domain name can only contain letters, numbers, and hyphens',
      'string.min': 'Domain name must be at least 3 characters',
      'string.max': 'Domain name must be at most 253 characters',
    }),

  tld: Joi.string()
    .min(1)
    .max(63)
    .pattern(/^[a-z]+$/)
    .invalid(...BLOCKED_TLDS)
    .required()
    .messages({
      'string.pattern.base': 'TLD can only contain lowercase letters',
      'any.invalid': 'This TLD is reserved and cannot be used',
    }),

  contentHash: Joi.string()
    .max(100)
    .optional()
    .allow(''),

  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Ethereum wallet address',
    }),
});

/**
 * Validate profit verification submission
 */
const profitVerificationSchema = Joi.object({
  verificationType: Joi.string()
    .valid('income_statement', 'stripe_atlas', 'accounting_api', 'manual', 'tax_return')
    .required(),

  reportedRevenue: Joi.number()
    .positive()
    .optional(),

  reportedProfit: Joi.number()
    .positive()
    .required(),

  reportingPeriodStart: Joi.date()
    .required(),

  reportingPeriodEnd: Joi.date()
    .greater(Joi.ref('reportingPeriodStart'))
    .required(),

  currency: Joi.string()
    .length(3)
    .uppercase()
    .default('USD'),

  stripeAccountId: Joi.string()
    .optional(),

  documents: Joi.array()
    .items(Joi.string())
    .max(10)
    .optional(),
});

/**
 * Validate payment intent creation
 */
const paymentIntentSchema = Joi.object({
  domainId: Joi.string()
    .uuid()
    .required(),

  amount: Joi.number()
    .positive()
    .required(),

  currency: Joi.string()
    .length(3)
    .lowercase()
    .default('usd'),
});

/**
 * Validate user registration
 */
const userRegistrationSchema = Joi.object({
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required(),

  email: Joi.string()
    .email()
    .optional(),

  signature: Joi.string()
    .required(),

  message: Joi.string()
    .required(),

  nonce: Joi.string()
    .required(),
});

/**
 * Sanitize string input (prevent XSS)
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Validate and sanitize pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} { page, limit, offset }
 */
const validatePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Validate file upload
 * @param {Object} file - Uploaded file
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateFileUpload = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  // Check file type
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'File type not allowed. Allowed: PDF, PNG, JPG' };
  }

  return { valid: true };
};

/**
 * Validate Ethereum signature
 * @param {string} message - Original message
 * @param {string} signature - Signature
 * @param {string} expectedAddress - Expected signer address
 * @returns {boolean} True if signature is valid
 */
const validateSignature = async (message, signature, expectedAddress) => {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    return false;
  }
};

module.exports = {
  isValidWalletAddress,
  validateDomainName,
  validateTLD,
  isValidEmail,
  domainRegistrationSchema,
  profitVerificationSchema,
  paymentIntentSchema,
  userRegistrationSchema,
  sanitizeString,
  validatePagination,
  validateFileUpload,
  validateSignature,
  BLOCKED_TLDS,
};
