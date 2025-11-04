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

## Architecture

```
├── contracts/          # Solidity smart contracts
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

5. **Deploy smart contracts**
```bash
# Deploy to local Hardhat network
npx hardhat node  # In one terminal
npm run deploy:local  # In another terminal

# Or deploy to testnet
npm run deploy:goerli
```

6. **Start the backend server**
```bash
cd backend
npm run dev
```

7. **Start the frontend**
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

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
