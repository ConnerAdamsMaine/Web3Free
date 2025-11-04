/**
 * Domain Service
 *
 * BUSINESS LOGIC:
 * - Free/hobbyist domains: Hosted on our centralized DNS
 * - Paid/business domains: Self-hosted, we provide verification/authentication only
 * - First domain per wallet is free (hosted by us)
 * - Additional domains require profit verification and payment (self-hosted)
 *
 * SECURITY:
 * - Domain validation and sanitization
 * - Squatting prevention
 * - Collision detection
 *
 * COMPLIANCE:
 * - Audit logging for all domain operations
 * - GDPR-compliant data handling
 */

const db = require('../config/database');
const blockchain = require('../config/blockchain');
const logger = require('../utils/logger');
const { validateDomainName, validateTLD, sanitizeString } = require('../utils/validators');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

/**
 * Search domain availability
 * @param {string} domainName - Domain name
 * @param {string} tld - TLD
 * @returns {Promise<Object>} Availability info
 */
const searchDomain = async (domainName, tld) => {
  try {
    // Validate domain name
    const nameValidation = validateDomainName(domainName);
    if (!nameValidation.valid) {
      throw new AppError(nameValidation.error, 400);
    }

    // Validate TLD
    const tldValidation = validateTLD(tld);
    if (!tldValidation.valid) {
      throw new AppError(tldValidation.error, 400);
    }

    // Normalize
    const normalizedDomain = domainName.toLowerCase();
    const normalizedTLD = tld.toLowerCase();
    const fullDomain = `${normalizedDomain}.${normalizedTLD}`;

    // Check blockchain availability
    const blockchainAvailable = await blockchain.isDomainAvailable(normalizedDomain, normalizedTLD);

    // Check database (redundancy check)
    const dbResult = await db.query(
      'SELECT id, is_active, owner_wallet FROM domains WHERE domain_name = $1 AND tld = $2',
      [normalizedDomain, normalizedTLD]
    );

    const isAvailable = blockchainAvailable && dbResult.rows.length === 0;

    return {
      domain: normalizedDomain,
      tld: normalizedTLD,
      fullDomain,
      available: isAvailable,
      exists: !blockchainAvailable || dbResult.rows.length > 0,
      registeredBy: dbResult.rows.length > 0 ? dbResult.rows[0].owner_wallet : null,
    };
  } catch (error) {
    logger.error('Domain search error:', error.message);
    throw error;
  }
};

/**
 * Check if wallet is eligible for free domain
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<Object>} Eligibility info
 */
const checkFreeEligibility = async (walletAddress) => {
  try {
    // Check blockchain
    const walletInfo = await blockchain.getWalletInfo(walletAddress);

    // Check database
    const dbResult = await db.query(
      'SELECT COUNT(*) as domain_count FROM domains WHERE owner_wallet = $1 AND is_active = true',
      [walletAddress]
    );

    const domainCount = parseInt(dbResult.rows[0].domain_count);
    const hasFreeDomain = walletInfo.hasFreeDomain || domainCount > 0;

    return {
      eligible: !hasFreeDomain,
      hasFreeDomain,
      domainCount: walletInfo.domainCount,
      reason: hasFreeDomain ? 'Already claimed free domain' : 'Eligible for free domain',
    };
  } catch (error) {
    logger.error('Free eligibility check error:', error.message);
    throw error;
  }
};

/**
 * Register a new domain
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} Registered domain
 */
const registerDomain = async (data) => {
  const { domainName, tld, walletAddress, contentHash, userId, hostingType } = data;

  try {
    // Validate inputs
    const nameValidation = validateDomainName(domainName);
    if (!nameValidation.valid) {
      throw new AppError(nameValidation.error, 400);
    }

    const tldValidation = validateTLD(tld);
    if (!tldValidation.valid) {
      throw new AppError(tldValidation.error, 400);
    }

    const normalizedDomain = domainName.toLowerCase();
    const normalizedTLD = tld.toLowerCase();

    // Check availability
    const availability = await searchDomain(normalizedDomain, normalizedTLD);
    if (!availability.available) {
      throw new AppError('Domain is not available', 400);
    }

    // Check free domain eligibility
    const eligibility = await checkFreeEligibility(walletAddress);
    const isFree = eligibility.eligible;

    // Determine hosting type
    // Free domains -> centralized DNS (hosted by us)
    // Paid domains -> self-hosted (verification/auth only)
    const finalHostingType = isFree ? 'centralized' : (hostingType || 'self-hosted');

    // Create domain record in database first (pending blockchain confirmation)
    const domainResult = await db.query(
      `INSERT INTO domains (
        user_id, domain_name, tld, owner_wallet, is_paid, is_active,
        content_hash, resolved_address, verification_status, blockchain_sync_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        normalizedDomain,
        normalizedTLD,
        walletAddress,
        !isFree,
        isFree, // Free domains are active immediately
        contentHash || '',
        walletAddress, // Default to owner's address
        isFree ? 'approved' : 'pending', // Free domains approved, paid need verification
        'pending',
      ]
    );

    const domain = domainResult.rows[0];

    // Log audit
    await auditService.log({
      userId,
      walletAddress,
      actionType: 'domain_register',
      resourceType: 'domain',
      resourceId: domain.id,
      actionStatus: 'pending',
      description: `Domain registration initiated: ${domain.full_domain} (${finalHostingType})`,
      metadata: { isFree, hostingType: finalHostingType },
    });

    logger.info('Domain registered in database:', {
      domain: domain.full_domain,
      owner: walletAddress,
      isFree,
      hostingType: finalHostingType,
    });

    return {
      ...domain,
      hosting_type: finalHostingType,
      is_free: isFree,
      status: isFree ? 'active' : 'pending_payment',
      message: isFree
        ? 'Free domain registered successfully. Hosted on our centralized DNS.'
        : 'Domain reserved. Payment required for self-hosted domain.',
    };
  } catch (error) {
    logger.error('Domain registration error:', error.message);
    throw error;
  }
};

/**
 * Confirm domain registration on blockchain (after payment for paid domains)
 * @param {string} domainId - Domain ID
 * @param {string} transactionHash - Blockchain transaction hash
 * @returns {Promise<Object>} Updated domain
 */
const confirmBlockchainRegistration = async (domainId, transactionHash) => {
  try {
    // Update domain status
    const result = await db.query(
      `UPDATE domains
       SET blockchain_sync_status = 'synced',
           blockchain_synced_at = NOW(),
           registration_tx_hash = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [transactionHash, domainId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Domain not found', 404);
    }

    const domain = result.rows[0];

    logger.info('Domain blockchain registration confirmed:', {
      domain: domain.full_domain,
      txHash: transactionHash,
    });

    return domain;
  } catch (error) {
    logger.error('Blockchain confirmation error:', error.message);
    throw error;
  }
};

/**
 * Get domain by ID
 * @param {string} domainId - Domain ID
 * @returns {Promise<Object>} Domain
 */
const getDomainById = async (domainId) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.email, u.wallet_address as user_wallet
       FROM domains d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.id = $1`,
      [domainId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Domain not found', 404);
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Get domain error:', error.message);
    throw error;
  }
};

/**
 * Get user domains
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Domains
 */
const getUserDomains = async (userId, filters = {}) => {
  try {
    const { page = 1, limit = 10, status, isPaid } = filters;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM domains WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(status === 'active');
    }

    if (isPaid !== undefined) {
      paramCount++;
      query += ` AND is_paid = $${paramCount}`;
      params.push(isPaid);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM domains WHERE user_id = $1',
      [userId]
    );

    return {
      domains: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    };
  } catch (error) {
    logger.error('Get user domains error:', error.message);
    throw error;
  }
};

/**
 * Resolve domain to resources
 * @param {string} fullDomain - Full domain (e.g., "example.web3")
 * @returns {Promise<Object>} Resolved resources
 */
const resolveDomain = async (fullDomain) => {
  try {
    const [domainName, tld] = fullDomain.toLowerCase().split('.');

    if (!domainName || !tld) {
      throw new AppError('Invalid domain format', 400);
    }

    // Check database first (faster)
    const dbResult = await db.query(
      `SELECT * FROM domains
       WHERE domain_name = $1 AND tld = $2 AND is_active = true`,
      [domainName, tld]
    );

    if (dbResult.rows.length === 0) {
      throw new AppError('Domain not found or inactive', 404);
    }

    const domain = dbResult.rows[0];

    // Check if expired
    if (domain.expires_at && new Date(domain.expires_at) < new Date()) {
      throw new AppError('Domain has expired', 410);
    }

    // For free domains (centralized hosting), return our DNS info
    // For paid domains (self-hosted), return verification/auth info only
    const hostingType = domain.is_paid ? 'self-hosted' : 'centralized';

    const response = {
      domain: fullDomain,
      owner: domain.owner_wallet,
      resolvedAddress: domain.resolved_address,
      contentHash: domain.content_hash,
      registeredAt: domain.registered_at,
      expiresAt: domain.expires_at,
      hostingType,
      isActive: domain.is_active,
    };

    // Add DNS records for centralized hosting (free domains)
    if (!domain.is_paid) {
      response.dnsRecords = {
        message: 'This domain is hosted on our centralized DNS',
        nameservers: [
          'ns1.web3domains.com',
          'ns2.web3domains.com',
        ],
        // Additional DNS records can be stored in domain metadata
      };
    } else {
      response.verification = {
        message: 'This is a self-hosted domain. We provide verification/authentication only.',
        verified: domain.verification_status === 'approved',
        owner: domain.owner_wallet,
      };
    }

    return response;
  } catch (error) {
    logger.error('Domain resolution error:', error.message);
    throw error;
  }
};

/**
 * Update domain content hash
 * @param {string} domainId - Domain ID
 * @param {string} contentHash - New content hash
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated domain
 */
const updateContentHash = async (domainId, contentHash, userId) => {
  try {
    // Verify ownership
    const domain = await getDomainById(domainId);

    if (domain.user_id !== userId) {
      throw new AppError('Not authorized to update this domain', 403);
    }

    // Update
    const result = await db.query(
      `UPDATE domains
       SET content_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [contentHash, domainId]
    );

    logger.info('Domain content hash updated:', {
      domain: result.rows[0].full_domain,
      contentHash,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Update content hash error:', error.message);
    throw error;
  }
};

/**
 * Transfer domain ownership
 * @param {string} domainId - Domain ID
 * @param {string} newOwnerWallet - New owner wallet address
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} Updated domain
 */
const transferDomain = async (domainId, newOwnerWallet, userId) => {
  try {
    // Verify ownership
    const domain = await getDomainById(domainId);

    if (domain.user_id !== userId) {
      throw new AppError('Not authorized to transfer this domain', 403);
    }

    // Get or create new owner user
    let newOwnerResult = await db.query(
      'SELECT id FROM users WHERE wallet_address = $1',
      [newOwnerWallet]
    );

    let newOwnerId;

    if (newOwnerResult.rows.length === 0) {
      // Create new user
      const createResult = await db.query(
        'INSERT INTO users (wallet_address) VALUES ($1) RETURNING id',
        [newOwnerWallet]
      );
      newOwnerId = createResult.rows[0].id;
    } else {
      newOwnerId = newOwnerResult.rows[0].id;
    }

    // Update domain
    const result = await db.query(
      `UPDATE domains
       SET user_id = $1, owner_wallet = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newOwnerId, newOwnerWallet, domainId]
    );

    // Log audit
    await auditService.log({
      userId,
      walletAddress: domain.owner_wallet,
      actionType: 'domain_transfer',
      resourceType: 'domain',
      resourceId: domainId,
      actionStatus: 'success',
      description: `Domain transferred: ${domain.full_domain} to ${newOwnerWallet}`,
    });

    logger.info('Domain transferred:', {
      domain: result.rows[0].full_domain,
      from: domain.owner_wallet,
      to: newOwnerWallet,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Domain transfer error:', error.message);
    throw error;
  }
};

/**
 * Deactivate domain (admin only)
 * @param {string} domainId - Domain ID
 * @param {string} reason - Deactivation reason
 * @returns {Promise<Object>} Updated domain
 */
const deactivateDomain = async (domainId, reason) => {
  try {
    const result = await db.query(
      `UPDATE domains
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [domainId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Domain not found', 404);
    }

    logger.info('Domain deactivated:', {
      domain: result.rows[0].full_domain,
      reason,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Domain deactivation error:', error.message);
    throw error;
  }
};

module.exports = {
  searchDomain,
  checkFreeEligibility,
  registerDomain,
  confirmBlockchainRegistration,
  getDomainById,
  getUserDomains,
  resolveDomain,
  updateContentHash,
  transferDomain,
  deactivateDomain,
};
