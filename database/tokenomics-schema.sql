-- Additional schema for tokenomics

-- Token balances (W3B)
CREATE TABLE IF NOT EXISTS token_balances (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(18, 8) NOT NULL DEFAULT 0,
    staked DECIMAL(18, 8) NOT NULL DEFAULT 0,
    locked DECIMAL(18, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_balances_balance ON token_balances(balance);

-- Token transactions
CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount DECIMAL(18, 8) NOT NULL,
    type VARCHAR(20) NOT NULL, -- credit, debit, stake, unstake, burn
    reason VARCHAR(100),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_type CHECK (type IN ('credit', 'debit', 'stake', 'unstake', 'burn', 'reward'))
);

CREATE INDEX idx_token_tx_user ON token_transactions(user_id);
CREATE INDEX idx_token_tx_created ON token_transactions(created_at);

-- Token stakes (for earning yield)
CREATE TABLE IF NOT EXISTS token_stakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staked_amount DECIMAL(18, 8) NOT NULL,
    stake_tier VARCHAR(20), -- bronze, silver, gold, platinum
    staked_at TIMESTAMP DEFAULT NOW(),
    unstake_at TIMESTAMP, -- NULL means still staked
    is_active BOOLEAN DEFAULT TRUE,
    total_rewards_earned DECIMAL(18, 8) DEFAULT 0,

    CONSTRAINT valid_tier CHECK (stake_tier IN ('bronze', 'silver', 'gold', 'platinum'))
);

CREATE INDEX idx_stakes_user ON token_stakes(user_id);
CREATE INDEX idx_stakes_active ON token_stakes(is_active) WHERE is_active = TRUE;

-- Token burns (deflationary record)
CREATE TABLE IF NOT EXISTS token_burns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount DECIMAL(18, 8) NOT NULL,
    burn_type VARCHAR(50), -- fee_burn, buyback_burn, etc
    tx_hash VARCHAR(66),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_burns_timestamp ON token_burns(timestamp);

-- Token pools (treasury, staker rewards, etc)
CREATE TABLE IF NOT EXISTS token_pools (
    pool_type VARCHAR(50) PRIMARY KEY,
    balance DECIMAL(18, 8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize pools
INSERT INTO token_pools (pool_type, balance) VALUES
    ('treasury', 0),
    ('staker_rewards', 0),
    ('ecosystem', 0)
ON CONFLICT DO NOTHING;

-- Token operations (buyback & burn tracking)
CREATE TABLE IF NOT EXISTS token_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    operation_type VARCHAR(50) NOT NULL,
    usd_amount DECIMAL(18, 2),
    w3b_amount DECIMAL(18, 8),
    w3b_price DECIMAL(18, 8),
    burned_amount DECIMAL(18, 8),
    staker_amount DECIMAL(18, 8),
    treasury_amount DECIMAL(18, 8),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_operations_type ON token_operations(operation_type);
CREATE INDEX idx_operations_created ON token_operations(created_at);

-- Network fees (domain resolution fees)
CREATE TABLE IF NOT EXISTS network_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fee_type VARCHAR(50) NOT NULL,
    domain VARCHAR(253),
    validator_id VARCHAR(255),
    amount DECIMAL(18, 8) NOT NULL,
    burned DECIMAL(18, 8),
    validator_share DECIMAL(18, 8),
    staker_share DECIMAL(18, 8),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_network_fees_domain ON network_fees(domain);
CREATE INDEX idx_network_fees_validator ON network_fees(validator_id);
CREATE INDEX idx_network_fees_created ON network_fees(created_at);

-- Token metrics (summary statistics)
CREATE TABLE IF NOT EXISTS token_metrics (
    id SERIAL PRIMARY KEY,
    total_burned DECIMAL(18, 8) DEFAULT 0,
    total_staked DECIMAL(18, 8) DEFAULT 0,
    total_distributed DECIMAL(18, 8) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize metrics
INSERT INTO token_metrics DEFAULT VALUES ON CONFLICT DO NOTHING;

-- Token prices (historical)
CREATE TABLE IF NOT EXISTS token_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price DECIMAL(18, 8) NOT NULL,
    source VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_prices_timestamp ON token_prices(timestamp);

-- Premium subscriptions (paid in W3B)
CREATE TABLE IF NOT EXISTS premium_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL,
    w3b_price DECIMAL(18, 8) NOT NULL,
    billing_period VARCHAR(20) DEFAULT 'monthly',
    started_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    auto_renew BOOLEAN DEFAULT TRUE,

    CONSTRAINT valid_service CHECK (service_type IN (
        'premium_dns', 'ipfs_pinning', 'developer_api',
        'custom_nameservers', 'priority_support'
    )),
    CONSTRAINT valid_period CHECK (billing_period IN ('monthly', 'yearly'))
);

CREATE INDEX idx_subs_user ON premium_subscriptions(user_id);
CREATE INDEX idx_subs_active ON premium_subscriptions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_subs_expires ON premium_subscriptions(expires_at);

-- Views for analytics

-- Total value locked (TVL)
CREATE OR REPLACE VIEW tvl_stats AS
SELECT
    SUM(staked) as total_staked,
    (SELECT SUM(balance) FROM token_pools) as total_pools,
    (SELECT SUM(amount) FROM token_burns) as total_burned,
    (SELECT price FROM token_prices ORDER BY timestamp DESC LIMIT 1) as current_price
FROM token_balances;

-- Staking tiers distribution
CREATE OR REPLACE VIEW staking_distribution AS
SELECT
    stake_tier,
    COUNT(*) as stakers_count,
    SUM(staked_amount) as total_staked,
    AVG(staked_amount) as avg_staked,
    SUM(total_rewards_earned) as total_rewards
FROM token_stakes
WHERE is_active = TRUE
GROUP BY stake_tier;

-- Daily burn rate
CREATE OR REPLACE VIEW daily_burn_rate AS
SELECT
    DATE(timestamp) as date,
    SUM(amount) as daily_burned,
    COUNT(*) as burn_count
FROM token_burns
GROUP BY DATE(timestamp)
ORDER BY date DESC;
