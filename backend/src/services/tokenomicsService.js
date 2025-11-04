/**
 * Tokenomics Service
 *
 * Implements the value accrual mechanisms for W3B tokens:
 * 1. Buyback & Burn from USD revenue
 * 2. Staking rewards distribution
 * 3. Network usage fee collection
 * 4. Revenue sharing with stakers
 */

const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const BLOCKCHAIN_NODE_URL = process.env.BLOCKCHAIN_NODE_URL || 'http://localhost:3001';
const W3B_TO_USD_ORACLE = process.env.W3B_ORACLE_URL || 'https://api.coingecko.com/api/v3/simple/price?ids=w3b&vs_currencies=usd';

class TokenomicsService {
  constructor() {
    // Token economics parameters
    this.domainRegistrationFee = 100; // W3B tokens
    this.domainRegistrationUSD = 10;  // USD equivalent
    this.burnPercentage = 0.50;       // 50% of fees
    this.stakerPercentage = 0.25;     // 25% to stakers
    this.treasuryPercentage = 0.25;   // 25% to treasury

    // Network usage tax
    this.resolutionFee = 0.0001;      // W3B per domain resolution
    this.resolutionBurnRate = 0.50;   // 50% burned
    this.resolutionValidatorRate = 0.25; // 25% to validators
    this.resolutionStakerRate = 0.25; // 25% to stakers

    // Premium service pricing (W3B per month)
    this.premiumServices = {
      premiumDNS: 50,
      ipfsPinning1TB: 100,
      developerAPI: 500,
      customNameservers: 200,
      prioritySupport: 25,
    };
  }

  /**
   * Execute buyback and burn when user pays USD
   * @param {number} usdAmount - Amount paid in USD
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Transaction details
   */
  async buybackAndBurn(usdAmount, userId) {
    try {
      logger.info('Executing buyback and burn', { usdAmount, userId });

      // 1. Get current W3B price
      const w3bPrice = await this.getW3BPrice();

      // 2. Calculate W3B to buy
      const w3bToBuy = usdAmount / w3bPrice;

      // 3. Execute market buy (in production, this would use a DEX)
      // For now, simulate by minting to system wallet
      const buyTx = await this.executeMarketBuy(w3bToBuy);

      // 4. Split according to percentages
      const toBurn = w3bToBuy * this.burnPercentage;
      const toStakers = w3bToBuy * this.stakerPercentage;
      const toTreasury = w3bToBuy * this.treasuryPercentage;

      // 5. Execute burn
      const burnTx = await this.burnTokens(toBurn);

      // 6. Distribute to stakers
      const stakerTx = await this.distributeToStakers(toStakers);

      // 7. Add to treasury
      const treasuryTx = await this.addToTreasury(toTreasury);

      // 8. Record in database
      await db.query(
        `INSERT INTO token_operations (
          user_id, operation_type, usd_amount, w3b_amount, w3b_price,
          burned_amount, staker_amount, treasury_amount, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          'buyback_burn',
          usdAmount,
          w3bToBuy,
          w3bPrice,
          toBurn,
          toStakers,
          toTreasury,
          JSON.stringify({ buyTx, burnTx, stakerTx, treasuryTx }),
        ]
      );

      logger.info('Buyback and burn completed', {
        w3bBought: w3bToBuy,
        burned: toBurn,
        toStakers,
        toTreasury,
      });

      return {
        success: true,
        w3bBought: w3bToBuy,
        burned: toBurn,
        stakerDistribution: toStakers,
        treasuryAddition: toTreasury,
        w3bPrice,
        transactions: {
          buy: buyTx,
          burn: burnTx,
          stakers: stakerTx,
          treasury: treasuryTx,
        },
      };
    } catch (error) {
      logger.error('Buyback and burn error:', error);
      throw error;
    }
  }

  /**
   * Process domain registration with token economics
   * @param {Object} data - Registration data
   * @returns {Promise<Object>} Result
   */
  async processDomainRegistration(data) {
    const { userId, domainId, paymentMethod } = data;

    try {
      if (paymentMethod === 'usd') {
        // User paid in USD → Execute buyback and burn
        const result = await this.buybackAndBurn(this.domainRegistrationUSD, userId);

        // Credit user with W3B equivalent for their records
        await this.creditTokens(userId, this.domainRegistrationFee, 'domain_registration');

        return {
          ...result,
          message: `Domain registered. ${result.burned} W3B burned, creating deflationary pressure.`,
        };
      } else if (paymentMethod === 'w3b') {
        // User paid directly in W3B
        // Deduct from user balance
        await this.deductTokens(userId, this.domainRegistrationFee);

        // Apply burn/staker/treasury split
        const toBurn = this.domainRegistrationFee * this.burnPercentage;
        const toStakers = this.domainRegistrationFee * this.stakerPercentage;
        const toTreasury = this.domainRegistrationFee * this.treasuryPercentage;

        await this.burnTokens(toBurn);
        await this.distributeToStakers(toStakers);
        await this.addToTreasury(toTreasury);

        return {
          success: true,
          w3bPaid: this.domainRegistrationFee,
          burned: toBurn,
          message: 'Domain registered with W3B tokens',
        };
      }
    } catch (error) {
      logger.error('Domain registration token processing error:', error);
      throw error;
    }
  }

  /**
   * Collect network usage fee (domain resolution)
   * @param {string} domain - Domain name
   * @param {string} validatorId - Validator ID
   */
  async collectResolutionFee(domain, validatorId) {
    try {
      // Small fee for domain resolution
      const fee = this.resolutionFee;

      // Split fee
      const toBurn = fee * this.resolutionBurnRate;
      const toValidator = fee * this.resolutionValidatorRate;
      const toStakers = fee * this.resolutionStakerRate;

      // Execute
      await this.burnTokens(toBurn);
      await this.creditTokens(validatorId, toValidator, 'resolution_fee');
      await this.distributeToStakers(toStakers);

      // Record
      await db.query(
        `INSERT INTO network_fees (
          fee_type, domain, validator_id, amount, burned, validator_share, staker_share
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['resolution', domain, validatorId, fee, toBurn, toValidator, toStakers]
      );

      logger.debug('Resolution fee collected', { domain, fee, toBurn });
    } catch (error) {
      logger.error('Resolution fee collection error:', error);
      // Don't throw - this shouldn't block resolution
    }
  }

  /**
   * Calculate and distribute staking rewards
   * @returns {Promise<Object>} Distribution summary
   */
  async distributeStakingRewards() {
    try {
      // Get total staked and all stakers
      const stakers = await db.query(`
        SELECT user_id, staked_amount,
               staked_amount::float / (SELECT SUM(staked_amount) FROM token_stakes WHERE is_active = true) as share
        FROM token_stakes
        WHERE is_active = true
      `);

      if (stakers.rows.length === 0) {
        logger.info('No active stakers for reward distribution');
        return { distributed: 0 };
      }

      // Get pending rewards from staker pool
      const poolResult = await db.query(
        'SELECT balance FROM token_pools WHERE pool_type = $1',
        ['staker_rewards']
      );

      const rewardPool = parseFloat(poolResult.rows[0]?.balance || 0);

      if (rewardPool === 0) {
        logger.info('No rewards in staker pool');
        return { distributed: 0 };
      }

      let totalDistributed = 0;

      // Distribute to each staker proportionally
      for (const staker of stakers.rows) {
        const reward = rewardPool * staker.share;

        await this.creditTokens(staker.user_id, reward, 'staking_reward');
        totalDistributed += reward;

        logger.debug('Staking reward distributed', {
          userId: staker.user_id,
          reward,
          share: staker.share,
        });
      }

      // Deduct from pool
      await db.query(
        'UPDATE token_pools SET balance = balance - $1 WHERE pool_type = $2',
        [totalDistributed, 'staker_rewards']
      );

      logger.info('Staking rewards distributed', {
        totalDistributed,
        stakersCount: stakers.rows.length,
      });

      return {
        distributed: totalDistributed,
        stakersCount: stakers.rows.length,
        averageReward: totalDistributed / stakers.rows.length,
      };
    } catch (error) {
      logger.error('Staking reward distribution error:', error);
      throw error;
    }
  }

  /**
   * Execute market buy of W3B tokens
   * In production, this would interact with a DEX (Uniswap, etc.)
   */
  async executeMarketBuy(w3bAmount) {
    // TODO: Integrate with DEX
    // For now, simulate by recording the buy
    logger.info('Market buy executed (simulated)', { w3bAmount });

    return {
      success: true,
      amount: w3bAmount,
      txHash: 'simulated_' + Date.now(),
    };
  }

  /**
   * Burn tokens (remove from circulation)
   */
  async burnTokens(amount) {
    try {
      // Send tokens to burn address on blockchain
      const burnTx = await axios.post(`${BLOCKCHAIN_NODE_URL}/api/transaction`, {
        from: 'system',
        to: '0x0000000000000000000000000000000000000000', // Burn address
        amount: amount,
        type: 'burn',
        data: { timestamp: Date.now() },
      });

      // Record burn
      await db.query(
        'INSERT INTO token_burns (amount, tx_hash, timestamp) VALUES ($1, $2, NOW())',
        [amount, burnTx.data.transaction.hash]
      );

      // Update total burned counter
      await db.query(
        'UPDATE token_metrics SET total_burned = total_burned + $1',
        [amount]
      );

      logger.info('Tokens burned', { amount, txHash: burnTx.data.transaction.hash });

      return burnTx.data;
    } catch (error) {
      logger.error('Token burn error:', error);
      throw error;
    }
  }

  /**
   * Distribute tokens to stakers pool
   */
  async distributeToStakers(amount) {
    try {
      // Add to staker rewards pool
      await db.query(
        `INSERT INTO token_pools (pool_type, balance)
         VALUES ('staker_rewards', $1)
         ON CONFLICT (pool_type)
         DO UPDATE SET balance = token_pools.balance + $1`,
        [amount]
      );

      logger.info('Tokens added to staker pool', { amount });

      return { success: true, amount };
    } catch (error) {
      logger.error('Staker distribution error:', error);
      throw error;
    }
  }

  /**
   * Add tokens to treasury
   */
  async addToTreasury(amount) {
    try {
      await db.query(
        `INSERT INTO token_pools (pool_type, balance)
         VALUES ('treasury', $1)
         ON CONFLICT (pool_type)
         DO UPDATE SET balance = token_pools.balance + $1`,
        [amount]
      );

      logger.info('Tokens added to treasury', { amount });

      return { success: true, amount };
    } catch (error) {
      logger.error('Treasury addition error:', error);
      throw error;
    }
  }

  /**
   * Credit tokens to user
   */
  async creditTokens(userId, amount, reason) {
    try {
      await db.query(
        `INSERT INTO token_balances (user_id, balance)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET balance = token_balances.balance + $2`,
        [userId, amount]
      );

      // Record transaction
      await db.query(
        `INSERT INTO token_transactions (user_id, amount, type, reason)
         VALUES ($1, $2, 'credit', $3)`,
        [userId, amount, reason]
      );

      logger.debug('Tokens credited', { userId, amount, reason });
    } catch (error) {
      logger.error('Token credit error:', error);
      throw error;
    }
  }

  /**
   * Deduct tokens from user
   */
  async deductTokens(userId, amount) {
    try {
      // Check balance
      const balance = await this.getUserBalance(userId);

      if (balance < amount) {
        throw new AppError('Insufficient W3B balance', 400);
      }

      await db.query(
        'UPDATE token_balances SET balance = balance - $1 WHERE user_id = $2',
        [amount, userId]
      );

      // Record transaction
      await db.query(
        `INSERT INTO token_transactions (user_id, amount, type, reason)
         VALUES ($1, $2, 'debit', 'payment')`,
        [userId, amount]
      );

      logger.debug('Tokens deducted', { userId, amount });
    } catch (error) {
      logger.error('Token deduction error:', error);
      throw error;
    }
  }

  /**
   * Get user's W3B balance
   */
  async getUserBalance(userId) {
    try {
      const result = await db.query(
        'SELECT balance FROM token_balances WHERE user_id = $1',
        [userId]
      );

      return parseFloat(result.rows[0]?.balance || 0);
    } catch (error) {
      logger.error('Get balance error:', error);
      return 0;
    }
  }

  /**
   * Get current W3B price in USD
   */
  async getW3BPrice() {
    try {
      // In production, fetch from oracle/exchange
      const response = await axios.get(W3B_TO_USD_ORACLE);
      return response.data.w3b?.usd || 0.10; // Default $0.10
    } catch (error) {
      logger.error('Price oracle error:', error);
      // Fallback to stored price
      const stored = await db.query(
        'SELECT price FROM token_prices ORDER BY timestamp DESC LIMIT 1'
      );
      return parseFloat(stored.rows[0]?.price || 0.10);
    }
  }

  /**
   * Get tokenomics statistics
   */
  async getStats() {
    try {
      const [metrics, pools, burned] = await Promise.all([
        db.query('SELECT * FROM token_metrics LIMIT 1'),
        db.query('SELECT pool_type, balance FROM token_pools'),
        db.query('SELECT SUM(amount) as total FROM token_burns'),
      ]);

      const price = await this.getW3BPrice();

      return {
        price,
        totalSupply: 1000000000, // Initial supply
        circulatingSupply: 1000000000 - (parseFloat(burned.rows[0]?.total || 0)),
        totalBurned: parseFloat(burned.rows[0]?.total || 0),
        pools: pools.rows.reduce((acc, p) => {
          acc[p.pool_type] = parseFloat(p.balance);
          return acc;
        }, {}),
        marketCap: (1000000000 - parseFloat(burned.rows[0]?.total || 0)) * price,
      };
    } catch (error) {
      logger.error('Get tokenomics stats error:', error);
      throw error;
    }
  }
}

module.exports = new TokenomicsService();
