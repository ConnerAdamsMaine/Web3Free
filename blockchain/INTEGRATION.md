# Blockchain Integration with Domain Registry

This document explains how to integrate the Web3Browse blockchain with the existing domain registry system.

## Architecture

The system operates on two layers:

1. **Ethereum Layer** (Existing): Authoritative domain ownership records
2. **Web3Browse Layer** (New): Fast domain resolution and validator rewards

## Integration Points

### 1. Domain Registration Flow

```
User registers domain → Backend API → Ethereum contract (ownership)
                                    ↓
                                Web3Browse blockchain (resolution + rewards)
```

#### Implementation

**Backend API Modification** (`backend/src/services/domainService.js`):

```javascript
const { registerDomain } = require('./domainService');
const blockchainNode = require('../../../blockchain/core/blockchain');

async function registerDomainWithBlockchain(domainData) {
  // 1. Register on Ethereum (existing code)
  const ethereumTx = await registerDomain(domainData);

  // 2. Register on Web3Browse blockchain for fast resolution
  const web3BrowseTx = await axios.post('http://localhost:3001/api/transaction', {
    from: 'system', // System address for domain registrations
    to: domainData.walletAddress,
    amount: 0,
    type: 'domain_register',
    data: {
      domain: domainData.domainName,
      tld: domainData.tld,
      contentHash: domainData.contentHash,
      ethereumTx: ethereumTx.hash,
    },
  });

  return {
    ethereum: ethereumTx,
    web3browse: web3BrowseTx.data,
  };
}
```

### 2. Domain Resolution

Chrome extension/browser checks Web3Browse blockchain first for fast resolution:

```javascript
async function resolveDomain(domain) {
  try {
    // Try Web3Browse blockchain (local, fast)
    const response = await fetch(`http://localhost:3001/api/domain/resolve/${domain}`);
    const web3Result = await response.json();

    if (web3Result.success) {
      return {
        address: web3Result.resolvedAddress,
        contentHash: web3Result.contentHash,
        source: 'web3browse',
      };
    }
  } catch (error) {
    // Fallback to Ethereum
    return resolveFromEthereum(domain);
  }
}
```

### 3. Validator Rewards

Users browsing domains earn rewards:

1. Extension detects Web3Browse domain visit
2. Reports to blockchain node
3. User participates in block validation
4. Earns W3B tokens

**Reward Distribution**:

```javascript
// In blockchain core
async function creditBrowsingReward(validator, domain) {
  // Check if domain is registered on our system
  const isOurDomain = await checkDomainRegistry(domain);

  if (isOurDomain) {
    // Higher reward for browsing our domains
    const reward = 5; // W3B tokens

    const tx = new Transaction(null, validator.id, reward, 'browse_reward', {
      domain: domain,
      timestamp: Date.now(),
    });

    // Add to next block
    blockchain.pendingTransactions.push(tx);
  }
}
```

### 4. Dual-Chain Sync

Keep both chains synchronized:

```javascript
// Sync service (runs on backend)
class BlockchainSyncService {
  async syncFromEthereum() {
    // Listen for Ethereum events
    ethereumContract.on('DomainRegistered', async (domain, tld, owner) => {
      // Add to Web3Browse blockchain
      await this.addToWeb3Browse({
        domain,
        tld,
        owner,
        source: 'ethereum',
      });
    });
  }

  async syncToEthereum() {
    // Periodically sync Web3Browse → Ethereum
    // Only for domains that need Ethereum security
    setInterval(async () => {
      const pendingSync = await getPendingSyncDomains();

      for (const domain of pendingSync) {
        await registerOnEthereum(domain);
      }
    }, 3600000); // Every hour
  }
}
```

## Database Schema Updates

Add blockchain fields to existing `domains` table:

```sql
ALTER TABLE domains ADD COLUMN web3browse_tx_hash VARCHAR(66);
ALTER TABLE domains ADD COLUMN web3browse_block_number INTEGER;
ALTER TABLE domains ADD COLUMN resolution_source VARCHAR(20) DEFAULT 'ethereum';

CREATE INDEX idx_domains_web3browse_tx ON domains(web3browse_tx_hash);
```

## API Endpoints Updates

### New Endpoints

```
POST /api/blockchain/sync
    - Manually trigger blockchain sync

GET /api/blockchain/stats
    - Get blockchain statistics

GET /api/domain/:domain/blockchain-info
    - Get Web3Browse blockchain info for domain

POST /api/validator/claim-rewards
    - Claim earned W3B tokens
```

### Modified Endpoints

```
POST /api/domains/register
    - Now registers on both chains

GET /api/domains/resolve/:domain
    - Returns both Ethereum and Web3Browse info
```

## Chrome Extension Integration

The extension connects to both systems:

```javascript
// Extension background script
class DualChainConnector {
  constructor() {
    this.ethereumProvider = new ethers.BrowserProvider(window.ethereum);
    this.web3browseNode = 'http://localhost:3001';
  }

  async resolveDomain(domain) {
    // Try Web3Browse first (faster)
    const web3Result = await this.resolveFromWeb3Browse(domain);

    if (web3Result) {
      // Verify against Ethereum
      const ethResult = await this.resolveFromEthereum(domain);

      if (ethResult.owner === web3Result.owner) {
        return web3Result; // Verified!
      } else {
        // Mismatch - use Ethereum as source of truth
        return ethResult;
      }
    }

    // Fallback to Ethereum only
    return this.resolveFromEthereum(domain);
  }
}
```

## Hosting Model Integration

### Free Domains (Centralized DNS)

- Registered on both Ethereum and Web3Browse
- Hosted on our DNS servers
- Fast resolution via Web3Browse blockchain
- Ethereum provides ownership proof

### Paid Domains (Self-Hosted)

- Ownership on Ethereum
- Resolution metadata on Web3Browse
- Users host their own infrastructure
- Web3Browse provides verification only

## Deployment

### 1. Start Blockchain Node

```bash
cd blockchain
npm install
node core/index.js
```

### 2. Update Backend

```bash
cd backend
# Add blockchain connection config
echo "WEB3BROWSE_NODE_URL=http://localhost:3001" >> .env

# Restart backend
pm2 restart web3domains-api
```

### 3. Deploy Extension

```bash
cd blockchain/extension
# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable Developer Mode
# 3. Load Unpacked → select extension folder
```

## Testing

### Local Testing

```bash
# Terminal 1: Start blockchain testnet
cd blockchain
./scripts/start-testnet.sh

# Terminal 2: Start backend
cd backend
npm run dev

# Terminal 3: Start frontend
cd frontend
npm start

# Browser: Load extension and test
```

### Integration Tests

```javascript
describe('Dual-Chain Integration', () => {
  it('should register domain on both chains', async () => {
    const domain = await registerDomain({
      domainName: 'test',
      tld: 'web3',
      walletAddress: testWallet,
    });

    expect(domain.ethereum.hash).toBeDefined();
    expect(domain.web3browse.hash).toBeDefined();
  });

  it('should resolve from Web3Browse blockchain', async () => {
    const resolved = await resolveDomain('test.web3');

    expect(resolved.source).toBe('web3browse');
    expect(resolved.address).toBe(testWallet);
  });

  it('should earn rewards while browsing', async () => {
    const initialBalance = await getBalance(validatorId);

    await browsedomains(['test.web3', 'example.web3']);
    await waitForBlockCreation();

    const newBalance = await getBalance(validatorId);
    expect(newBalance).toBeGreaterThan(initialBalance);
  });
});
```

## Monitoring

Track both chains:

```javascript
// Dashboard metrics
{
  ethereum: {
    totalDomains: 1250,
    totalTransactions: 5430,
    gasUsed: '2.5 ETH',
  },
  web3browse: {
    totalBlocks: 142500,
    activeValidators: 342,
    totalRewardsDistributed: '1.2M W3B',
    avgBlockTime: '3.1s',
  },
  sync: {
    lastSyncTime: '2024-01-15 10:30:00',
    pendingSync: 5,
    syncHealth: 'good',
  }
}
```

## Troubleshooting

### Sync Issues

```bash
# Check sync status
curl http://localhost:3001/api/blockchain/sync/status

# Force sync
curl -X POST http://localhost:3001/api/blockchain/sync/force
```

### Resolution Failures

```javascript
// Debug resolution
const debug = await resolveDomainDebug('test.web3');
console.log({
  web3browse: debug.web3browse, // Result from Web3Browse chain
  ethereum: debug.ethereum,     // Result from Ethereum
  match: debug.match,           // Do they match?
  source: debug.usedSource,     // Which was used?
});
```

## Security Considerations

1. **Ethereum as Source of Truth**: Always verify ownership via Ethereum
2. **Web3Browse for Speed**: Use for fast resolution, not ownership proof
3. **Validator Rewards**: Distribute from separate pool, not domain registry
4. **Sync Monitoring**: Alert if chains diverge significantly

## Future Enhancements

1. **Cross-chain bridges**: Allow W3B ↔ ETH swaps
2. **L2 integration**: Move Ethereum to Polygon/Arbitrum
3. **Sharding**: Scale Web3Browse to millions of TPS
4. **Mobile browsers**: iOS/Android versions
