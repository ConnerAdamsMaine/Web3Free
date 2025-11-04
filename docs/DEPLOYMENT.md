# Deployment Guide

Complete guide for deploying the Web3 Domain Registry System to production.

## Prerequisites

- Node.js v16+ and npm/yarn
- PostgreSQL 13+
- Ethereum wallet with ETH for gas fees
- Stripe account (for payment processing)
- Domain name and SSL certificate
- Server with Ubuntu 20.04+ (recommended)

## Infrastructure Setup

### 1. Server Requirements

**Minimum Specifications:**
- 2 CPU cores
- 4GB RAM
- 50GB SSD
- Ubuntu 20.04 LTS

**Recommended Specifications:**
- 4 CPU cores
- 8GB RAM
- 100GB SSD
- Load balancer for high availability

### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

## Database Setup

### 1. Create Database

```bash
sudo -u postgres psql

CREATE DATABASE web3domains;
CREATE USER web3domains_app WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE web3domains TO web3domains_app;
\q
```

### 2. Run Migrations

```bash
cd /path/to/Web3Free
psql web3domains < database/schema.sql
```

### 3. Configure Backups

```bash
# Add to crontab
0 2 * * * pg_dump -Fc web3domains > /backups/web3domains_$(date +\%Y\%m\%d).dump
```

## Smart Contract Deployment

### 1. Configure Environment

```bash
cd /path/to/Web3Free
cp .env.example .env

# Edit .env with your values
nano .env
```

### 2. Deploy to Testnet (Goerli)

```bash
# Install dependencies
npm install

# Deploy
npm run deploy:goerli

# Save the contract address - you'll need it for backend configuration
```

### 3. Deploy to Mainnet (Production)

```bash
# IMPORTANT: Test thoroughly on testnet first!
npm run deploy:mainnet

# Verify on Etherscan
npm run verify -- --network mainnet <CONTRACT_ADDRESS>
```

### 4. Authorize Verifier

```bash
# Generate backend wallet
npx hardhat run scripts/generate-wallet.js

# Fund the wallet with ETH for gas fees

# Authorize as verifier
VERIFIER_ADDRESS=0x... npm run scripts/authorize-verifier.js --network mainnet
```

## Backend Deployment

### 1. Configure Environment

```bash
cd backend
cp .env.example .env

# Edit with production values
nano .env
```

**Important Environment Variables:**

```bash
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_NAME=web3domains
DB_USER=web3domains_app
DB_PASSWORD=your_secure_password
DB_SSL=true

CONTRACT_ADDRESS=0x... # From deployment
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
VERIFIER_PRIVATE_KEY=0x... # From generate-wallet.js

JWT_SECRET=$(openssl rand -base64 64)
ENCRYPTION_KEY=$(openssl rand -base64 32)

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

CORS_ORIGINS=https://yourdomain.com
```

### 2. Install and Build

```bash
npm install --production
```

### 3. Start with PM2

```bash
pm2 start src/server.js --name web3domains-api
pm2 save
pm2 startup
```

### 4. Configure Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Frontend Deployment

### 1. Configure Environment

```bash
cd frontend
cp .env.example .env

# Edit with production values
nano .env
```

```bash
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_CONTRACT_ADDRESS=0x...
REACT_APP_CHAIN_ID=1
REACT_APP_NETWORK_NAME=mainnet
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 2. Build

```bash
npm install
npm run build
```

### 3. Deploy to Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /var/www/web3domains/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## SSL Configuration

### Using Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Monitoring & Logging

### 1. PM2 Monitoring

```bash
# View logs
pm2 logs web3domains-api

# Monitor
pm2 monit

# Setup log rotation
pm2 install pm2-logrotate
```

### 2. Database Monitoring

```bash
# Install pg_stat_statements
sudo -u postgres psql web3domains

CREATE EXTENSION pg_stat_statements;
```

### 3. Alerts

Configure monitoring with:
- Uptime monitoring (UptimeRobot, Pingdom)
- Error tracking (Sentry)
- Performance monitoring (New Relic, DataDog)

## Security Checklist

- [ ] Firewall configured (UFW)
- [ ] SSH key authentication only
- [ ] Database password strong and unique
- [ ] Environment variables secured
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Regular security updates
- [ ] Backup strategy implemented
- [ ] Private keys in hardware wallet or KMS

## Backup Strategy

### Database Backups

```bash
# Daily automated backups
0 2 * * * pg_dump -Fc web3domains > /backups/web3domains_$(date +\%Y\%m\%d).dump

# Keep 30 days of backups
find /backups -name "web3domains_*.dump" -mtime +30 -delete
```

### Code Backups

- Use Git for version control
- Tag releases
- Store environment files securely (not in Git)

### Restore Procedure

```bash
# Restore database
pg_restore -d web3domains /backups/web3domains_20240101.dump
```

## Scaling Considerations

### Database Scaling

- Read replicas for queries
- Connection pooling (PgBouncer)
- Regular VACUUM and ANALYZE

### Application Scaling

- Load balancer (Nginx, HAProxy)
- Multiple backend instances
- Redis for session storage and caching

### Blockchain Scaling

- Use Layer 2 networks (Polygon, Arbitrum)
- Batch transactions
- Optimize gas usage

## Troubleshooting

### Common Issues

**Backend won't start:**
- Check environment variables
- Verify database connection
- Check port availability

**Contract interactions fail:**
- Verify RPC URL
- Check wallet has ETH for gas
- Verify contract address

**Payment failures:**
- Check Stripe webhook signature
- Verify API keys
- Check webhook endpoint is accessible

## Post-Deployment

1. Test all functionality
2. Monitor logs for errors
3. Verify Stripe webhooks
4. Test domain registration flow
5. Verify payment processing
6. Check blockchain transactions

## Support

For issues:
- GitHub Issues: [repository-url]/issues
- Email: support@yourdomain.com
