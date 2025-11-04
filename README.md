# Web3 Domain Registry System

A complete blockchain-based domain registration system with custom TLDs, profit-based verification, and integrated payment processing.

## Features

- **Custom TLDs**: Register domains with any TLD (excluding reserved ones like .eth, .crypto, etc.)
- **On-Chain Registry**: Ethereum-compatible smart contracts for domain ownership
- **Free First Domain**: Each wallet gets one free domain
- **Profit-Based Verification**: Additional domains require proof of business profitability
- **Payment Integration**: Stripe integration for fiat and crypto payments
- **Domain Resolution**: API endpoints for resolving domains to wallet addresses, IPFS/Arweave content
- **User Dashboard**: Complete UI for domain management and verification status
- **Enterprise Security**: Rate limiting, encryption, input validation, and anti-fraud measures
- **Compliance Ready**: GDPR/CCPA privacy handling, KYC/AML support

## W3B Token Economics

### Overview

The Web3 Domain Registry System is powered by **W3B tokens** and runs on a custom **Web3Browse blockchain** with an innovative **Proof of Browse (PoB)** consensus mechanism. This creates a unique ecosystem where users earn tokens simply by browsing domains, and those tokens gain real value through sustainable tokenomics.

### 🌐 Proof of Browse: Turn Browsing into Earning

**How It Works:**
1. **Install the Chrome Extension** - Turns your browser into a blockchain light node
2. **Browse Web3 Domains** - Each domain visit validates transactions
3. **Earn W3B Tokens** - Get rewarded for securing the network

```
Your Browser → Domain Visit → Blockchain Validation → Earn W3B
```

**Why This Matters:**
- **No specialized hardware required** - Any computer can participate
- **Network security scales with usage** - More users = more security
- **Passive income** - Earn while doing what you already do
- **Real contribution** - You're actually securing the network

### 💰 Real Value Creation: Buyback & Burn

Unlike speculative tokens, W3B creates **real, measurable value** through revenue-based tokenomics:

**The Mechanism:**
```
Domain Registration Revenue (USD)
    ↓
50% → Buy W3B from Market
    ↓
├─ 50% Burned Forever (Deflationary)
├─ 25% Distributed to Stakers
└─ 25% Added to Treasury
```

**What This Means:**
- **Every domain registered** → W3B tokens are bought and burned
- **Supply decreases** → Scarcity increases
- **Demand increases** → More users need W3B for domains
- **Price increases** → Basic supply/demand economics

**Example:**
- 10,000 domains registered at $50 each = $500,000 revenue
- $500,000 buys W3B from market (creates buy pressure)
- 50% of W3B burned forever (reduces supply)
- Token price increases mathematically

### 🔥 Token Utility: Mandatory, Not Optional

W3B tokens have **mandatory utility** - you cannot use core features without them:

**Required Uses:**
- ✅ **Domain Registration** - Must pay in W3B for additional domains
- ✅ **Premium Services** - Analytics, monitoring, advanced DNS (W3B only)
- ✅ **Marketplace Trading** - Buy/sell domains (W3B only)
- ✅ **Governance Voting** - Propose and vote on protocol changes
- ✅ **Network Fees** - Micro-fees (0.0001 W3B) per domain resolution

**This Creates Constant Demand:**
- Can't register domains without W3B → Must buy/earn
- Can't access premium features → Must hold W3B
- Can't trade on marketplace → Need W3B
- More users = More demand = Higher price

### 📊 Multiple Earning Mechanisms

**1. Browse-to-Earn (Proof of Browse)**
- Earn tokens by browsing Web3 domains
- ~0.1-1 W3B per validation session
- Automatic background earning

**2. Staking Rewards**
- 20% APY from **real protocol revenue** (not inflation)
- Earn proportional share of buyback pool
- No lock-up period required

**3. Network Usage Fees**
- Every domain resolution pays 0.0001 W3B to validators
- High-traffic domains = more fees to earn
- Scales with network growth

**4. Premium Services**
- Offer domain management services
- Get paid in W3B
- Build businesses on the protocol

**5. Domain Marketplace**
- Buy domains early, sell when valuable
- All trading in W3B
- Capital appreciation opportunity

### 🏗️ Dual-Chain Architecture

The system uses **two blockchains** for optimal performance:

**Ethereum (Ownership Chain):**
- Stores authoritative domain ownership records
- Immutable, secure, trusted
- Handles ownership transfers
- Slow but extremely secure

**Web3Browse (Resolution Chain):**
- Fast domain resolution (3-second blocks)
- Proof of Browse consensus
- Token rewards and fees
- Browser-friendly architecture

**How They Work Together:**
1. Domain ownership recorded on Ethereum (permanent)
2. Domain resolution happens on Web3Browse (fast)
3. Chains sync automatically via bridge
4. Best of both worlds: Security + Speed

### 🚀 Getting Started: Earn Your First W3B

**Step 1: Install the Chrome Extension**
```bash
# Load extension from blockchain/extension/
# Chrome → Extensions → Developer Mode → Load Unpacked
```

**Step 2: Register as a Validator**
- Extension automatically generates validator ID
- No registration fee required
- Start earning immediately

**Step 3: Browse and Earn**
- Visit any Web3 domain from our registry
- Extension validates transactions in background
- Earn W3B automatically

**Step 4: Check Your Balance**
- View earnings in extension popup
- See real-time rewards
- Track validation history

**Step 5: Use or Stake Your W3B**
- Register additional domains
- Stake for 20% APY rewards
- Trade on marketplace
- Access premium features

### 📈 Value Projection Model

Based on conservative estimates:

| Metric | Year 1 | Year 3 | Year 5 |
|--------|--------|--------|--------|
| **Registered Domains** | 10,000 | 100,000 | 1,000,000 |
| **Annual Revenue** | $500K | $5M | $50M |
| **W3B Bought & Burned** | $250K | $2.5M | $25M |
| **Circulating Supply** | -10% | -25% | -40% |
| **Estimated Token Price** | +50% | +300% | +1500% |

*Note: Projections are estimates based on adoption assumptions. See `blockchain/TOKENOMICS.md` for detailed calculations.*

### 🔗 Token Documentation

For detailed technical information:
- **Full Tokenomics**: See `blockchain/TOKENOMICS.md`
- **Value Proposition**: See `VALUE-PROPOSITION.md`
- **Blockchain Integration**: See `blockchain/INTEGRATION.md`
- **Browser Specification**: See `blockchain/browser-config/BROWSER-SPEC.md`

### 💡 Why W3B Has Real Value

**Traditional Tokens:** Speculative value only
**W3B Token:** Multiple value sources

1. ✅ **Revenue Buyback** - Real USD revenue buys tokens
2. ✅ **Deflationary Supply** - 50% burned forever
3. ✅ **Mandatory Utility** - Required for core features
4. ✅ **Network Effects** - More users = more value
5. ✅ **Real Yield** - Staking rewards from protocol revenue
6. ✅ **Browse-to-Earn** - Earn tokens passively
7. ✅ **Scaling Security** - Security increases with adoption

**Result:** Token value is tied to real business metrics, not speculation.

---

## Architecture

```
├── contracts/          # Solidity smart contracts (Ethereum)
├── blockchain/         # Web3Browse blockchain + Chrome extension
├── backend/           # Node.js Express API
├── frontend/          # React frontend with Web3 integration
├── database/          # PostgreSQL schema and migrations
├── scripts/           # Deployment and setup scripts
└── docs/              # Documentation
```

## Quick Start

### Prerequisites

- Node.js v16+ and npm/yarn
- PostgreSQL 13+
- Ethereum wallet (MetaMask) for testing
- Stripe account for payment processing
- Access to Ethereum testnet (Goerli, Sepolia, or local Hardhat network)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Web3Free
```

2. **Install dependencies**
```bash
# Install contract dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

3. **Configure environment variables**
```bash
# Backend configuration
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend configuration
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your settings
```

4. **Set up the database**
```bash
# Create PostgreSQL database
createdb web3domains

# Run migrations
psql web3domains < database/schema.sql
```

5. **Set up tokenomics database**
```bash
# Add tokenomics tables
psql web3domains < database/tokenomics-schema.sql
```

6. **Deploy smart contracts**
```bash
# Deploy to local Hardhat network
npx hardhat node  # In one terminal
npm run deploy:local  # In another terminal

# Or deploy to testnet
npm run deploy:goerli
```

7. **Start the Web3Browse blockchain node**
```bash
cd blockchain/core
npm install
npm start
# Node will run on http://localhost:3001
```

8. **Start the backend server**
```bash
cd backend
npm run dev
```

9. **Start the frontend**
```bash
cd frontend
npm start
```

10. **Install the Chrome Extension (Optional - for Browse-to-Earn)**
```bash
# Open Chrome and navigate to chrome://extensions/
# Enable "Developer mode"
# Click "Load unpacked"
# Select the blockchain/extension/ directory
# Extension icon will appear in toolbar
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Blockchain Node: http://localhost:3001
- Chrome Extension: Load from blockchain/extension/

## Smart Contract Deployment

### Local Development
```bash
npx hardhat node
npm run deploy:local
```

### Testnet (Goerli)
```bash
npm run deploy:goerli
```

### Mainnet (Production)
```bash
npm run deploy:mainnet
```

## API Documentation

### Authentication
All protected endpoints require Web3 wallet signature authentication.

### Key Endpoints

- `POST /api/auth/login` - Authenticate with wallet signature
- `GET /api/domains/search?name=example&tld=web3` - Search domain availability
- `POST /api/domains/register` - Register a new domain
- `GET /api/domains/resolve/:domain` - Resolve domain to resources
- `POST /api/verification/submit` - Submit profit verification
- `POST /api/payments/create-checkout` - Create Stripe checkout session
- `GET /api/users/dashboard` - Get user dashboard data

See `docs/API.md` for complete API documentation.

## Security Features

- **Smart Contract Security**: Reentrancy guards, overflow protection, access controls
- **API Security**: Rate limiting, JWT authentication, input validation
- **Data Protection**: Encryption at rest and in transit (TLS)
- **Payment Security**: PCI-compliant Stripe integration
- **Anti-Fraud**: Domain squatting prevention, payment verification
- **Audit Logging**: Complete audit trail for all operations

## Compliance & Legal

- **Privacy**: GDPR and CCPA compliant data handling
- **KYC/AML**: Integration points for identity verification
- **Terms of Service**: Legal disclaimers for domain ownership
- **Data Retention**: Configurable retention policies

See `docs/LEGAL.md` for complete compliance information.

## Testing

```bash
# Test smart contracts
npm run test:contracts

# Test backend
cd backend
npm test

# Test frontend
cd frontend
npm test
```

## Deployment

See `docs/DEPLOYMENT.md` for production deployment instructions.

## Gas Optimization

The smart contracts are optimized for gas efficiency:
- Minimal storage operations
- Efficient data structures (mappings)
- Optional Layer-2 support for lower costs

## Scaling Considerations

- **Database**: PostgreSQL with read replicas for high availability
- **API**: Horizontal scaling with load balancer
- **Caching**: Redis for frequently accessed data
- **CDN**: CloudFlare or similar for frontend assets
- **Blockchain**: Support for Layer-2 networks (Polygon, Arbitrum, Optimism)

## Backup Strategy

- **Database**: Automated daily backups with point-in-time recovery
- **Smart Contracts**: Immutable on-chain, no backup needed
- **Private Keys**: Hardware security modules (HSM) for production
- **Configuration**: Version controlled and encrypted

## Monitoring & Alerts

- Application performance monitoring (APM)
- Smart contract event monitoring
- Payment webhook monitoring
- Error tracking and alerting
- Uptime monitoring

## Contributing

See `CONTRIBUTING.md` for guidelines.

## License

See `LICENSE` file for details.

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Email: support@yourdomain.com
- Documentation: [docs-url]

## Roadmap

- [ ] Gasless registration via meta-transactions
- [ ] Multi-chain support (Polygon, BSC, Avalanche)
- [ ] ENS integration for .eth domains
- [ ] IPFS/Arweave gateway for decentralized hosting
- [ ] Mobile app for domain management
- [ ] Browser extension for custom TLD resolution
- [ ] Domain marketplace for buying/selling
- [ ] Subdomain support
- [ ] DNS record management (A, CNAME, TXT, etc.)
