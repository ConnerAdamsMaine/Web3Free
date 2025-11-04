#!/usr/bin/env node

/**
 * Web3Browse Blockchain Node
 *
 * Full node implementation with Proof of Browse consensus
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Blockchain, Transaction } = require('./blockchain');
const P2PNetwork = require('../network/p2p');
const logger = require('../utils/logger');

class BlockchainNode {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3001,
      wsPort: config.wsPort || 3002,
      p2pPort: config.p2pPort || 9000,
      p2pWsPort: config.p2pWsPort || 9001,
      bootstrapPeers: config.bootstrapPeers || [],
      ...config,
    };

    // Initialize blockchain
    this.blockchain = new Blockchain();

    // Initialize P2P network
    this.p2p = new P2PNetwork({
      port: this.config.p2pPort,
      wsPort: this.config.p2pWsPort,
      bootstrapPeers: this.config.bootstrapPeers,
    });

    // HTTP API server
    this.app = express();
    this.server = http.createServer(this.app);

    // WebSocket server for real-time updates
    this.wss = new WebSocket.Server({ server: this.server });

    // Block creation interval
    this.blockInterval = null;

    this.setupAPI();
    this.setupWebSocket();
    this.setupBlockchain();
    this.setupP2P();
  }

  setupAPI() {
    this.app.use(express.json());

    // Enable CORS for browser extension
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        blockchain: this.blockchain.getStats(),
        network: this.p2p.getStats(),
      });
    });

    // Get blockchain info
    this.app.get('/api/blockchain', (req, res) => {
      res.json({
        chain: this.blockchain.chain,
        length: this.blockchain.chain.length,
        stats: this.blockchain.getStats(),
      });
    });

    // Get specific block
    this.app.get('/api/block/:index', (req, res) => {
      const index = parseInt(req.params.index);
      const block = this.blockchain.chain[index];

      if (!block) {
        return res.status(404).json({ error: 'Block not found' });
      }

      res.json(block);
    });

    // Get balance
    this.app.get('/api/balance/:address', (req, res) => {
      const balance = this.blockchain.getBalance(req.params.address);
      res.json({ address: req.params.address, balance });
    });

    // Submit transaction
    this.app.post('/api/transaction', (req, res) => {
      try {
        const { from, to, amount, type, data, signature } = req.body;

        const transaction = new Transaction(from, to, amount, type, data);
        transaction.signature = signature;

        this.blockchain.addTransaction(transaction);

        // Broadcast to network
        this.p2p.broadcastTransaction(transaction);

        res.json({
          success: true,
          transaction: {
            hash: transaction.hash,
            from,
            to,
            amount,
          },
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Register as validator (browser node)
    this.app.post('/api/validator/register', (req, res) => {
      try {
        const validator = req.body;

        this.blockchain.registerValidator(validator);
        this.p2p.announceValidator(validator);

        res.json({
          success: true,
          validator: {
            id: validator.id,
            status: 'active',
          },
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update validator activity
    this.app.post('/api/validator/activity', (req, res) => {
      try {
        const { validatorId, domain } = req.body;

        this.blockchain.updateValidatorActivity(validatorId, domain);
        this.p2p.broadcastValidatorActivity(validatorId, domain);

        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Unregister validator
    this.app.post('/api/validator/unregister', (req, res) => {
      try {
        const { validatorId } = req.body;
        this.blockchain.unregisterValidator(validatorId);

        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get network stats
    this.app.get('/api/network', (req, res) => {
      res.json({
        peers: this.p2p.getPeers(),
        validators: Array.from(this.blockchain.activeValidators.values()),
        stats: this.p2p.getStats(),
      });
    });

    // Get pending transactions
    this.app.get('/api/transactions/pending', (req, res) => {
      res.json({
        transactions: this.blockchain.pendingTransactions,
        count: this.blockchain.pendingTransactions.length,
      });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      logger.info('WebSocket client connected');

      // Send current blockchain state
      ws.send(JSON.stringify({
        type: 'init',
        data: {
          blockchain: this.blockchain.getStats(),
          network: this.p2p.getStats(),
        },
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });
    });
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        // Client wants real-time updates
        ws.subscribed = true;
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        logger.warn('Unknown WebSocket message type:', data.type);
    }
  }

  broadcastWebSocket(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.subscribed) {
        client.send(JSON.stringify(message));
      }
    });
  }

  setupBlockchain() {
    // Listen for blockchain events
    this.blockchain.on('blockCreated', (block) => {
      logger.info('Block created', {
        index: block.index,
        transactions: block.transactions.length,
        validators: block.validatorSignatures.length,
      });

      // Broadcast to P2P network
      this.p2p.broadcastBlock(block);

      // Broadcast to WebSocket clients
      this.broadcastWebSocket({
        type: 'newBlock',
        data: block,
      });
    });

    this.blockchain.on('transactionAdded', (transaction) => {
      this.broadcastWebSocket({
        type: 'newTransaction',
        data: transaction,
      });
    });

    this.blockchain.on('validatorJoined', (validator) => {
      this.broadcastWebSocket({
        type: 'validatorJoined',
        data: validator,
      });
    });
  }

  setupP2P() {
    // Listen for P2P events
    this.p2p.on('block', (data) => {
      // Received block from network
      // Validate and add to chain if valid
      logger.debug('Received block from network', data);
    });

    this.p2p.on('transaction', (data) => {
      // Received transaction from network
      try {
        const tx = data.transaction;
        this.blockchain.addTransaction(tx);
      } catch (error) {
        logger.error('Error adding transaction from network:', error);
      }
    });

    this.p2p.on('validator', (data) => {
      // Received validator announcement
      if (data.type === 'validator_joined') {
        this.blockchain.registerValidator(data.validator);
      }
    });

    this.p2p.on('peerConnected', (peerId) => {
      this.broadcastWebSocket({
        type: 'peerConnected',
        data: { peerId },
      });
    });
  }

  startBlockProduction() {
    // Create new blocks periodically
    this.blockInterval = setInterval(async () => {
      try {
        const block = await this.blockchain.createNewBlock();

        if (!block) {
          logger.debug('Block creation skipped (no validators or consensus failed)');
        }
      } catch (error) {
        logger.error('Error creating block:', error);
      }
    }, this.blockchain.blockTime);

    logger.info('Block production started', {
      interval: `${this.blockchain.blockTime}ms`,
    });
  }

  async start() {
    try {
      // Start P2P network
      await this.p2p.start();

      // Start HTTP server
      this.server.listen(this.config.port, () => {
        logger.info('='.repeat(60));
        logger.info('🚀 Web3Browse Blockchain Node Started');
        logger.info('='.repeat(60));
        logger.info(`HTTP API:     http://localhost:${this.config.port}`);
        logger.info(`WebSocket:    ws://localhost:${this.config.port}`);
        logger.info(`P2P TCP:      tcp://localhost:${this.config.p2pPort}`);
        logger.info(`P2P WebSocket: ws://localhost:${this.config.p2pWsPort}`);
        logger.info('='.repeat(60));
        logger.info('Blockchain:', this.blockchain.getStats());
        logger.info('='.repeat(60));
      });

      // Start block production
      this.startBlockProduction();

      logger.info('Node fully initialized and ready');
    } catch (error) {
      logger.error('Failed to start node:', error);
      process.exit(1);
    }
  }

  async stop() {
    logger.info('Shutting down node...');

    if (this.blockInterval) {
      clearInterval(this.blockInterval);
    }

    await this.p2p.stop();
    this.server.close();

    logger.info('Node stopped');
  }
}

// Start node if run directly
if (require.main === module) {
  const config = {
    port: process.env.API_PORT || 3001,
    p2pPort: process.env.P2P_PORT || 9000,
    p2pWsPort: process.env.P2P_WS_PORT || 9001,
    bootstrapPeers: process.env.BOOTSTRAP_PEERS ? process.env.BOOTSTRAP_PEERS.split(',') : [],
  };

  const node = new BlockchainNode(config);

  node.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await node.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await node.stop();
    process.exit(0);
  });
}

module.exports = BlockchainNode;
