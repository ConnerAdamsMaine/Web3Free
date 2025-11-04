/**
 * P2P Network Layer using libp2p
 *
 * Enables browser nodes and full nodes to communicate
 * directly in a decentralized peer-to-peer network.
 */

const { createLibp2p } = require('libp2p');
const { tcp } = require('@libp2p/tcp');
const { webSockets } = require('@libp2p/websockets');
const { mplex } = require('@libp2p/mplex');
const { noise } = require('@libp2p/noise');
const { gossipsub } = require('@chainsafe/libp2p-gossipsub');
const { kadDHT } = require('@libp2p/kad-dht');
const { bootstrap } = require('@libp2p/bootstrap');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class P2PNetwork extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      port: config.port || 9000,
      wsPort: config.wsPort || 9001, // WebSocket port for browser nodes
      bootstrapPeers: config.bootstrapPeers || [],
      ...config,
    };

    this.node = null;
    this.peers = new Map();

    // Topics for different message types
    this.topics = {
      blocks: '/web3browse/blocks/1.0.0',
      transactions: '/web3browse/transactions/1.0.0',
      validators: '/web3browse/validators/1.0.0',
      domains: '/web3browse/domains/1.0.0',
    };
  }

  async start() {
    try {
      // Create libp2p node
      this.node = await createLibp2p({
        addresses: {
          listen: [
            `/ip4/0.0.0.0/tcp/${this.config.port}`, // For full nodes
            `/ip4/0.0.0.0/tcp/${this.config.wsPort}/ws`, // For browser nodes
          ],
        },
        transports: [
          tcp(),
          webSockets(), // Essential for browser compatibility
        ],
        streamMuxers: [mplex()],
        connectionEncryption: [noise()],
        pubsub: gossipsub({
          emitSelf: false, // Don't emit messages to self
          allowPublishToZeroPeers: true,
        }),
        peerDiscovery: [
          bootstrap({
            list: this.config.bootstrapPeers,
          }),
        ],
        dht: kadDHT({
          clientMode: false,
          validators: {},
          selectors: {},
        }),
      });

      // Setup event listeners
      this.setupEventListeners();

      // Subscribe to topics
      this.subscribeToTopics();

      await this.node.start();

      const listenAddrs = this.node.getMultiaddrs();
      logger.info('P2P node started', {
        peerId: this.node.peerId.toString(),
        addresses: listenAddrs.map(addr => addr.toString()),
      });

      this.emit('started', {
        peerId: this.node.peerId.toString(),
        addresses: listenAddrs,
      });
    } catch (error) {
      logger.error('Failed to start P2P node:', error);
      throw error;
    }
  }

  setupEventListeners() {
    // Peer connection events
    this.node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail.toString();

      this.peers.set(peerId, {
        id: peerId,
        connectedAt: Date.now(),
        messageCount: 0,
        type: 'unknown', // full, light, browser
      });

      logger.info('Peer connected', { peerId });
      this.emit('peerConnected', peerId);
    });

    this.node.addEventListener('peer:disconnect', (evt) => {
      const peerId = evt.detail.toString();

      this.peers.delete(peerId);

      logger.info('Peer disconnected', { peerId });
      this.emit('peerDisconnected', peerId);
    });

    // Peer discovery events
    this.node.addEventListener('peer:discovery', (evt) => {
      const peerInfo = evt.detail;
      logger.debug('Peer discovered', { peerId: peerInfo.id.toString() });
    });
  }

  subscribeToTopics() {
    // Subscribe to all topics
    Object.entries(this.topics).forEach(([name, topic]) => {
      this.node.pubsub.subscribe(topic);
      logger.debug('Subscribed to topic', { name, topic });
    });

    // Handle incoming messages
    this.node.pubsub.addEventListener('message', (evt) => {
      this.handleMessage(evt.detail);
    });
  }

  handleMessage(message) {
    try {
      const topic = message.topic;
      const data = JSON.parse(new TextDecoder().decode(message.data));

      const from = message.from ? message.from.toString() : 'unknown';

      // Update peer stats
      if (this.peers.has(from)) {
        this.peers.get(from).messageCount++;
      }

      // Route message based on topic
      if (topic === this.topics.blocks) {
        this.emit('block', data);
      } else if (topic === this.topics.transactions) {
        this.emit('transaction', data);
      } else if (topic === this.topics.validators) {
        this.emit('validator', data);
      } else if (topic === this.topics.domains) {
        this.emit('domain', data);
      }

      logger.debug('Message received', {
        topic,
        from,
        type: data.type,
      });
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  }

  /**
   * Broadcast new block to network
   */
  async broadcastBlock(block) {
    const message = {
      type: 'new_block',
      block: block,
      timestamp: Date.now(),
    };

    await this.publish(this.topics.blocks, message);
    logger.debug('Block broadcasted', { index: block.index });
  }

  /**
   * Broadcast new transaction to network
   */
  async broadcastTransaction(transaction) {
    const message = {
      type: 'new_transaction',
      transaction: transaction,
      timestamp: Date.now(),
    };

    await this.publish(this.topics.transactions, message);
    logger.debug('Transaction broadcasted', { hash: transaction.hash });
  }

  /**
   * Announce validator (browser) joining network
   */
  async announceValidator(validator) {
    const message = {
      type: 'validator_joined',
      validator: validator,
      timestamp: Date.now(),
    };

    await this.publish(this.topics.validators, message);
    logger.debug('Validator announced', { id: validator.id });
  }

  /**
   * Broadcast validator activity (domain access)
   */
  async broadcastValidatorActivity(validatorId, domain) {
    const message = {
      type: 'validator_activity',
      validatorId: validatorId,
      domain: domain,
      timestamp: Date.now(),
    };

    await this.publish(this.topics.validators, message);
  }

  /**
   * Publish message to topic
   */
  async publish(topic, message) {
    try {
      const data = new TextEncoder().encode(JSON.stringify(message));
      await this.node.pubsub.publish(topic, data);
    } catch (error) {
      logger.error('Error publishing message:', error);
    }
  }

  /**
   * Request chain sync from peer
   */
  async requestChainSync(fromBlock = 0) {
    // Get a random connected peer
    const peers = Array.from(this.peers.keys());

    if (peers.length === 0) {
      logger.warn('No peers available for chain sync');
      return null;
    }

    const randomPeer = peers[Math.floor(Math.random() * peers.length)];

    const message = {
      type: 'chain_sync_request',
      fromBlock: fromBlock,
      timestamp: Date.now(),
    };

    // In a real implementation, this would use request-response protocol
    await this.publish(this.topics.blocks, message);

    logger.debug('Chain sync requested', { peer: randomPeer, fromBlock });
  }

  /**
   * Get network stats
   */
  getStats() {
    return {
      peerId: this.node ? this.node.peerId.toString() : null,
      peers: this.peers.size,
      peerDetails: Array.from(this.peers.values()),
      topics: Object.keys(this.topics).length,
    };
  }

  /**
   * Get connected peers
   */
  getPeers() {
    return Array.from(this.peers.values());
  }

  /**
   * Stop P2P node
   */
  async stop() {
    if (this.node) {
      await this.node.stop();
      logger.info('P2P node stopped');
      this.emit('stopped');
    }
  }
}

module.exports = P2PNetwork;
