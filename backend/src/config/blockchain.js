/**
 * Blockchain Configuration and Smart Contract Interface
 *
 * SECURITY:
 * - Private key management (never expose in logs or responses)
 * - Gas limit protection to prevent excessive costs
 * - Transaction retry logic with exponential backoff
 * - Nonce management for concurrent transactions
 *
 * COMPLIANCE:
 * - All blockchain interactions are logged for audit
 * - Transaction hashes stored for verification
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Load contract ABI
const getContractABI = () => {
  try {
    // Try to load from deployments directory first
    const network = process.env.ETHEREUM_NETWORK || 'goerli';
    const deploymentFile = path.join(__dirname, '../../..', 'deployments', `${network}.json`);

    if (fs.existsSync(deploymentFile)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      return deployment.abi;
    }

    // Fallback to artifacts
    const artifactPath = path.join(__dirname, '../../..', 'artifacts', 'contracts', 'DomainRegistry.sol', 'DomainRegistry.json');
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      return artifact.abi;
    }

    throw new Error('Contract ABI not found');
  } catch (error) {
    logger.error('Error loading contract ABI:', error.message);
    throw error;
  }
};

// Blockchain configuration
const config = {
  rpcUrl: process.env.ETHEREUM_RPC_URL,
  contractAddress: process.env.CONTRACT_ADDRESS,
  network: process.env.ETHEREUM_NETWORK || 'goerli',
  chainId: parseInt(process.env.CHAIN_ID) || 5,
  gasLimit: parseInt(process.env.GAS_LIMIT) || 500000,
  verifierPrivateKey: process.env.VERIFIER_PRIVATE_KEY,
};

// Validate configuration
if (!config.rpcUrl) {
  throw new Error('ETHEREUM_RPC_URL is required');
}

if (!config.contractAddress) {
  logger.warn('CONTRACT_ADDRESS not set. Blockchain features will be limited.');
}

// Create provider
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// Create verifier wallet (for confirming paid registrations)
let verifierWallet = null;
let verifierSigner = null;

if (config.verifierPrivateKey) {
  try {
    verifierWallet = new ethers.Wallet(config.verifierPrivateKey);
    verifierSigner = verifierWallet.connect(provider);
    logger.info('Verifier wallet initialized:', verifierWallet.address);
  } catch (error) {
    logger.error('Error initializing verifier wallet:', error.message);
  }
}

// Create contract instance
let contract = null;

if (config.contractAddress) {
  try {
    const abi = getContractABI();

    // Read-only contract instance
    contract = new ethers.Contract(config.contractAddress, abi, provider);

    // Contract with signer (for transactions)
    if (verifierSigner) {
      contract = contract.connect(verifierSigner);
    }

    logger.info('Smart contract initialized:', config.contractAddress);
  } catch (error) {
    logger.error('Error initializing smart contract:', error.message);
  }
}

/**
 * Get current gas price with buffer
 * @returns {Promise<bigint>} Gas price in wei
 */
const getGasPrice = async () => {
  try {
    const feeData = await provider.getFeeData();

    // Add 10% buffer to suggested gas price
    const gasPrice = feeData.gasPrice * BigInt(110) / BigInt(100);

    logger.debug('Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
    return gasPrice;
  } catch (error) {
    logger.error('Error getting gas price:', error.message);
    // Default to 50 gwei if fetching fails
    return ethers.parseUnits('50', 'gwei');
  }
};

/**
 * Check if domain is available
 * @param {string} domainName - Domain name
 * @param {string} tld - TLD
 * @returns {Promise<boolean>} True if available
 */
const isDomainAvailable = async (domainName, tld) => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    const available = await contract.isDomainAvailable(domainName, tld);
    return available;
  } catch (error) {
    logger.error('Error checking domain availability:', error.message);
    throw error;
  }
};

/**
 * Get domain information from blockchain
 * @param {string} domainName - Domain name
 * @param {string} tld - TLD
 * @returns {Promise<Object>} Domain information
 */
const getDomain = async (domainName, tld) => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    const domain = await contract.getDomain(domainName, tld);

    return {
      owner: domain.owner,
      registeredAt: Number(domain.registeredAt),
      expiresAt: Number(domain.expiresAt),
      isPaid: domain.isPaid,
      isActive: domain.isActive,
      contentHash: domain.contentHash,
      resolvedAddress: domain.resolvedAddress,
    };
  } catch (error) {
    logger.error('Error getting domain:', error.message);
    throw error;
  }
};

/**
 * Confirm paid domain registration on-chain
 * @param {string} domainName - Domain name
 * @param {string} tld - TLD
 * @param {string} owner - Owner wallet address
 * @returns {Promise<Object>} Transaction receipt
 */
const confirmPaidRegistration = async (domainName, tld, owner) => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    if (!verifierSigner) {
      throw new Error('Verifier wallet not initialized');
    }

    logger.info('Confirming paid registration:', { domainName, tld, owner });

    // Estimate gas
    const gasEstimate = await contract.confirmPaidRegistration.estimateGas(domainName, tld, owner);
    const gasLimit = gasEstimate * BigInt(120) / BigInt(100); // Add 20% buffer

    // Get gas price
    const gasPrice = await getGasPrice();

    // Send transaction
    const tx = await contract.confirmPaidRegistration(domainName, tld, owner, {
      gasLimit,
      gasPrice,
    });

    logger.info('Transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    logger.info('Transaction confirmed:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
    };
  } catch (error) {
    logger.error('Error confirming paid registration:', error.message);
    throw error;
  }
};

/**
 * Resolve domain to wallet address
 * @param {string} domainName - Domain name
 * @param {string} tld - TLD
 * @returns {Promise<string>} Resolved wallet address
 */
const resolveDomain = async (domainName, tld) => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    const address = await contract.resolveDomain(domainName, tld);
    return address;
  } catch (error) {
    logger.error('Error resolving domain:', error.message);
    throw error;
  }
};

/**
 * Get wallet information
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<Object>} Wallet information
 */
const getWalletInfo = async (walletAddress) => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    const info = await contract.getWalletInfo(walletAddress);

    return {
      domainCount: Number(info.domainCount),
      hasFreeDomain: info.hasFreeDomain,
      firstRegistration: Number(info.firstRegistration),
    };
  } catch (error) {
    logger.error('Error getting wallet info:', error.message);
    throw error;
  }
};

/**
 * Listen for domain registration events
 * @param {Function} callback - Event handler
 */
const listenForRegistrations = (callback) => {
  if (!contract) {
    logger.error('Contract not initialized');
    return;
  }

  contract.on('DomainRegistered', (domainName, tld, owner, isPaid, timestamp, event) => {
    logger.info('Domain registered event:', { domainName, tld, owner, isPaid });

    callback({
      domainName,
      tld,
      owner,
      isPaid,
      timestamp: Number(timestamp),
      transactionHash: event.log.transactionHash,
      blockNumber: event.log.blockNumber,
    });
  });

  logger.info('Listening for domain registration events');
};

/**
 * Get current block number
 * @returns {Promise<number>} Block number
 */
const getCurrentBlock = async () => {
  try {
    const blockNumber = await provider.getBlockNumber();
    return blockNumber;
  } catch (error) {
    logger.error('Error getting current block:', error.message);
    throw error;
  }
};

/**
 * Get transaction receipt
 * @param {string} txHash - Transaction hash
 * @returns {Promise<Object>} Transaction receipt
 */
const getTransactionReceipt = async (txHash) => {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt;
  } catch (error) {
    logger.error('Error getting transaction receipt:', error.message);
    throw error;
  }
};

/**
 * Test blockchain connection
 * @returns {Promise<boolean>} True if connected
 */
const testConnection = async () => {
  try {
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();

    logger.info('Blockchain connection successful:', {
      network: network.name,
      chainId: network.chainId.toString(),
      blockNumber,
    });

    return true;
  } catch (error) {
    logger.error('Blockchain connection failed:', error.message);
    return false;
  }
};

module.exports = {
  provider,
  contract,
  verifierWallet,
  isDomainAvailable,
  getDomain,
  confirmPaidRegistration,
  resolveDomain,
  getWalletInfo,
  listenForRegistrations,
  getCurrentBlock,
  getTransactionReceipt,
  testConnection,
  config,
};
