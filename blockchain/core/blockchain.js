/**
 * Web3Browse Blockchain Core
 *
 * Implements a custom blockchain with Proof of Browse consensus
 * where users browsing domains become network validators.
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const { Level } = require('level');
const logger = require('../utils/logger');

/**
 * Block class
 */
class Block {
  constructor(index, timestamp, transactions, previousHash = '', validator = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.validator = validator; // Browser/node that validated this block
    this.nonce = 0;
    this.hash = this.calculateHash();

    // Proof of Browse specific fields
    this.browseProofs = []; // Proof that validators were actively browsing
    this.validatorSignatures = []; // Multiple validator signatures for consensus
    this.domainAccesses = []; // Domains accessed during validation period
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.index +
        this.previousHash +
        this.timestamp +
        JSON.stringify(this.transactions) +
        this.nonce +
        JSON.stringify(this.browseProofs) +
        this.validator
      )
      .digest('hex');
  }

  /**
   * Add browse proof from a validator
   * @param {Object} proof - Browse proof object
   */
  addBrowseProof(proof) {
    this.browseProofs.push({
      validator: proof.validator,
      domain: proof.domain,
      timestamp: proof.timestamp,
      signature: proof.signature,
      browserFingerprint: proof.browserFingerprint,
    });
  }

  /**
   * Add validator signature
   * @param {string} signature - Validator's signature of block hash
   */
  addValidatorSignature(signature) {
    this.validatorSignatures.push(signature);
  }

  /**
   * Check if block has enough validator consensus
   * Requires 2/3+ validators to sign for finality
   */
  hasConsensus(totalValidators) {
    const required = Math.ceil((totalValidators * 2) / 3);
    return this.validatorSignatures.length >= required;
  }
}

/**
 * Transaction class
 */
class Transaction {
  constructor(fromAddress, toAddress, amount, type = 'transfer', data = {}) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.type = type; // transfer, domain_register, domain_transfer, contract_deploy, contract_call
    this.data = data; // Additional data based on type
    this.timestamp = Date.now();
    this.signature = null;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.fromAddress +
        this.toAddress +
        this.amount +
        this.timestamp +
        JSON.stringify(this.data)
      )
      .digest('hex');
  }

  /**
   * Sign transaction with private key
   * @param {string} privateKey - Private key in hex
   */
  signTransaction(privateKey) {
    const sign = crypto.createSign('SHA256');
    sign.update(this.hash);
    this.signature = sign.sign(privateKey, 'hex');
  }

  /**
   * Verify transaction signature
   * @param {string} publicKey - Public key in PEM format
   */
  isValid() {
    // Coinbase transactions (mining rewards) don't need signature
    if (this.fromAddress === null) return true;

    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }

    const verify = crypto.createVerify('SHA256');
    verify.update(this.hash);
    return verify.verify(this.fromAddress, this.signature, 'hex');
  }
}

/**
 * Blockchain class
 */
class Blockchain extends EventEmitter {
  constructor() {
    super();

    // Initialize database for persistent storage
    this.db = new Level('./data/blockchain', { valueEncoding: 'json' });

    // In-memory chain (loaded from db)
    this.chain = [];

    // Pending transactions pool
    this.pendingTransactions = [];

    // Current validators (browsers actively browsing)
    this.activeValidators = new Map();

    // Validator reputation scores
    this.validatorReputation = new Map();

    // Mining/validation reward
    this.miningReward = 50; // W3B tokens
    this.browsingReward = 5; // W3B tokens per block validated while browsing

    // Network parameters
    this.difficulty = 2; // Number of leading zeros required in hash (low for PoB)
    this.blockTime = 3000; // 3 seconds
    this.maxTransactionsPerBlock = 100;

    // Domain registry state (integrated with our domain system)
    this.domainRegistry = new Map();

    // Initialize
    this.init();
  }

  async init() {
    try {
      // Try to load existing chain from database
      const chainLength = await this.getChainLength();

      if (chainLength === 0) {
        // Create genesis block
        await this.createGenesisBlock();
      } else {
        // Load chain from database
        await this.loadChain();
      }

      logger.info('Blockchain initialized', {
        blocks: this.chain.length,
        validators: this.activeValidators.size,
      });
    } catch (error) {
      logger.error('Blockchain initialization error:', error);
      // Fallback to genesis
      await this.createGenesisBlock();
    }
  }

  async createGenesisBlock() {
    const genesis = new Block(0, Date.now(), [], '0', 'genesis');
    genesis.hash = genesis.calculateHash();

    this.chain.push(genesis);
    await this.saveBlock(genesis);

    logger.info('Genesis block created', { hash: genesis.hash });
  }

  async loadChain() {
    try {
      const length = await this.getChainLength();

      for (let i = 0; i < length; i++) {
        const block = await this.db.get(`block:${i}`);
        this.chain.push(this.deserializeBlock(block));
      }

      logger.info('Chain loaded from database', { blocks: this.chain.length });
    } catch (error) {
      logger.error('Error loading chain:', error);
      throw error;
    }
  }

  async getChainLength() {
    try {
      const meta = await this.db.get('meta:length');
      return meta.length;
    } catch (error) {
      return 0;
    }
  }

  async saveBlock(block) {
    try {
      await this.db.put(`block:${block.index}`, this.serializeBlock(block));
      await this.db.put('meta:length', { length: this.chain.length });
      await this.db.put('latest', block.hash);
    } catch (error) {
      logger.error('Error saving block:', error);
      throw error;
    }
  }

  serializeBlock(block) {
    return {
      index: block.index,
      timestamp: block.timestamp,
      transactions: block.transactions,
      previousHash: block.previousHash,
      validator: block.validator,
      nonce: block.nonce,
      hash: block.hash,
      browseProofs: block.browseProofs,
      validatorSignatures: block.validatorSignatures,
      domainAccesses: block.domainAccesses,
    };
  }

  deserializeBlock(data) {
    const block = new Block(
      data.index,
      data.timestamp,
      data.transactions,
      data.previousHash,
      data.validator
    );

    block.nonce = data.nonce;
    block.hash = data.hash;
    block.browseProofs = data.browseProofs || [];
    block.validatorSignatures = data.validatorSignatures || [];
    block.domainAccesses = data.domainAccesses || [];

    return block;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Register a validator (browser node)
   * @param {Object} validator - Validator info
   */
  registerValidator(validator) {
    const {
      id,
      publicKey,
      browserFingerprint,
      ipAddress,
      currentDomain,
    } = validator;

    this.activeValidators.set(id, {
      id,
      publicKey,
      browserFingerprint,
      ipAddress,
      currentDomain,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      blocksValidated: 0,
      rewardsEarned: 0,
    });

    // Initialize reputation if new
    if (!this.validatorReputation.has(id)) {
      this.validatorReputation.set(id, {
        score: 100, // Start with neutral score
        totalBlocks: 0,
        goodBlocks: 0,
        badBlocks: 0,
      });
    }

    logger.info('Validator registered', {
      id,
      domain: currentDomain,
      validators: this.activeValidators.size,
    });

    this.emit('validatorJoined', validator);
  }

  /**
   * Unregister validator (browser closed/navigated away)
   * @param {string} validatorId - Validator ID
   */
  unregisterValidator(validatorId) {
    const validator = this.activeValidators.get(validatorId);

    if (validator) {
      this.activeValidators.delete(validatorId);

      logger.info('Validator unregistered', {
        id: validatorId,
        blocksValidated: validator.blocksValidated,
        rewardsEarned: validator.rewardsEarned,
      });

      this.emit('validatorLeft', validator);
    }
  }

  /**
   * Update validator activity (browsing different domain)
   * @param {string} validatorId - Validator ID
   * @param {string} domain - New domain being accessed
   */
  updateValidatorActivity(validatorId, domain) {
    const validator = this.activeValidators.get(validatorId);

    if (validator) {
      validator.currentDomain = domain;
      validator.lastActive = Date.now();

      this.emit('validatorActivity', { validatorId, domain });
    }
  }

  /**
   * Create new block with Proof of Browse consensus
   * Validators are selected from active browsers
   */
  async createNewBlock() {
    const previousBlock = this.getLatestBlock();
    const index = previousBlock.index + 1;

    // Select transactions for this block
    const transactions = this.pendingTransactions.splice(
      0,
      this.maxTransactionsPerBlock
    );

    // Select validators from active browsers
    // Prioritize validators browsing domains hosted on our network
    const validators = this.selectValidators();

    if (validators.length === 0) {
      logger.warn('No active validators, waiting for browsers...');
      return null;
    }

    // Create new block
    const newBlock = new Block(
      index,
      Date.now(),
      transactions,
      previousBlock.hash,
      validators[0].id // Primary validator
    );

    // Collect browse proofs from validators
    for (const validator of validators) {
      const proof = await this.generateBrowseProof(validator);
      newBlock.addBrowseProof(proof);

      if (validator.currentDomain) {
        newBlock.domainAccesses.push({
          validator: validator.id,
          domain: validator.currentDomain,
          timestamp: Date.now(),
        });
      }
    }

    // Lightweight mining (PoB uses minimal PoW)
    await this.mineBlock(newBlock);

    // Collect validator signatures for consensus
    for (const validator of validators) {
      // In real implementation, request signature from validator node
      // const signature = await this.requestValidatorSignature(validator.id, newBlock.hash);
      // newBlock.addValidatorSignature(signature);
    }

    // Check consensus (2/3+ validators must sign)
    if (!newBlock.hasConsensus(validators.length)) {
      logger.warn('Block failed to reach consensus', {
        signatures: newBlock.validatorSignatures.length,
        required: Math.ceil((validators.length * 2) / 3),
      });

      // Re-add transactions to pending pool
      this.pendingTransactions.unshift(...transactions);
      return null;
    }

    // Add block to chain
    this.chain.push(newBlock);
    await this.saveBlock(newBlock);

    // Update validator stats and distribute rewards
    await this.distributeRewards(newBlock, validators);

    logger.info('New block created', {
      index: newBlock.index,
      hash: newBlock.hash.substring(0, 10),
      transactions: transactions.length,
      validators: validators.length,
    });

    this.emit('blockCreated', newBlock);

    return newBlock;
  }

  /**
   * Select validators for next block
   * Prioritizes validators browsing our domains
   */
  selectValidators() {
    const validators = Array.from(this.activeValidators.values());

    // Filter out inactive validators (no activity in last 30 seconds)
    const activeValidators = validators.filter(
      v => Date.now() - v.lastActive < 30000
    );

    // Sort by reputation and domain relevance
    const sorted = activeValidators.sort((a, b) => {
      const aRep = this.validatorReputation.get(a.id)?.score || 0;
      const bRep = this.validatorReputation.get(b.id)?.score || 0;

      // Bonus for browsing our domains
      const aBonus = a.currentDomain ? 10 : 0;
      const bBonus = b.currentDomain ? 10 : 0;

      return (bRep + bBonus) - (aRep + aBonus);
    });

    // Select top validators (minimum 3, maximum 21 for efficiency)
    const count = Math.min(Math.max(sorted.length, 3), 21);
    return sorted.slice(0, count);
  }

  /**
   * Generate browse proof for validator
   * Proves the validator was actively browsing
   */
  async generateBrowseProof(validator) {
    // In real implementation, this would be generated by the browser
    return {
      validator: validator.id,
      domain: validator.currentDomain,
      timestamp: Date.now(),
      browserFingerprint: validator.browserFingerprint,
      signature: crypto.randomBytes(32).toString('hex'), // Placeholder
    };
  }

  /**
   * Lightweight mining for PoB
   * Much easier than PoW, just for ordering/spam prevention
   */
  async mineBlock(block) {
    while (block.hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
      block.nonce++;
      block.hash = block.calculateHash();
    }
  }

  /**
   * Distribute rewards to validators
   */
  async distributeRewards(block, validators) {
    // Primary validator gets full mining reward
    const primaryValidator = validators[0];
    await this.creditReward(primaryValidator.id, this.miningReward);

    // Other validators get browsing rewards
    for (let i = 1; i < validators.length; i++) {
      await this.creditReward(validators[i].id, this.browsingReward);
    }

    // Update validator stats
    for (const validator of validators) {
      const v = this.activeValidators.get(validator.id);
      if (v) {
        v.blocksValidated++;
        v.rewardsEarned += (validator === primaryValidator ? this.miningReward : this.browsingReward);
      }

      const rep = this.validatorReputation.get(validator.id);
      if (rep) {
        rep.totalBlocks++;
        rep.goodBlocks++;
        rep.score = Math.min(rep.score + 1, 200); // Cap at 200
      }
    }
  }

  /**
   * Credit reward to validator
   * Creates a coinbase transaction
   */
  async creditReward(validatorId, amount) {
    const rewardTx = new Transaction(null, validatorId, amount, 'reward', {
      blockIndex: this.chain.length - 1,
    });

    // Reward transactions are added immediately, not pending
    this.getLatestBlock().transactions.push(rewardTx);
  }

  /**
   * Add transaction to pending pool
   */
  addTransaction(transaction) {
    // Validate transaction
    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction');
    }

    // Check sender has sufficient balance
    const balance = this.getBalance(transaction.fromAddress);
    if (balance < transaction.amount) {
      throw new Error('Insufficient balance');
    }

    this.pendingTransactions.push(transaction);
    this.emit('transactionAdded', transaction);

    logger.debug('Transaction added to pool', {
      hash: transaction.hash.substring(0, 10),
      from: transaction.fromAddress?.substring(0, 10),
      to: transaction.toAddress?.substring(0, 10),
      amount: transaction.amount,
    });
  }

  /**
   * Get balance for an address
   */
  getBalance(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }

        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  /**
   * Validate entire blockchain
   */
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Validate block hash
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        logger.error('Invalid block hash', { index: i });
        return false;
      }

      // Validate chain linkage
      if (currentBlock.previousHash !== previousBlock.hash) {
        logger.error('Invalid chain linkage', { index: i });
        return false;
      }

      // Validate transactions
      for (const trans of currentBlock.transactions) {
        if (trans.fromAddress !== null && !trans.isValid()) {
          logger.error('Invalid transaction in block', { index: i });
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get blockchain stats
   */
  getStats() {
    return {
      blocks: this.chain.length,
      transactions: this.chain.reduce((sum, block) => sum + block.transactions.length, 0),
      activeValidators: this.activeValidators.size,
      pendingTransactions: this.pendingTransactions.length,
      latestBlock: {
        index: this.getLatestBlock().index,
        hash: this.getLatestBlock().hash,
        timestamp: this.getLatestBlock().timestamp,
      },
    };
  }
}

module.exports = { Blockchain, Block, Transaction };
