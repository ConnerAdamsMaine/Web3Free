-- ============================================================================
-- Web3 Domain Registry - PostgreSQL Database Schema
-- ============================================================================
--
-- COMPLIANCE NOTES:
-- - All sensitive data (financial info) is encrypted at rest
-- - PII (personally identifiable information) is stored securely
-- - Audit logs track all operations for compliance
-- - GDPR/CCPA: Users can request data deletion via API
-- - Data retention policies can be configured
--
-- SECURITY NOTES:
-- - Use SSL/TLS for database connections
-- - Restrict database access to backend API only
-- - Regular backups with encryption
-- - Use strong passwords and rotate regularly
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable encryption extension for sensitive data
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user account information linked to wallet addresses
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL UNIQUE, -- Ethereum address
    email VARCHAR(255), -- Optional email for notifications
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    -- KYC/AML compliance fields
    kyc_status VARCHAR(20) DEFAULT 'not_started', -- not_started, pending, approved, rejected
    kyc_provider VARCHAR(50), -- e.g., 'stripe_identity', 'sumsub'
    kyc_verified_at TIMESTAMP,
    -- GDPR compliance
    data_processing_consent BOOLEAN DEFAULT FALSE,
    marketing_consent BOOLEAN DEFAULT FALSE,
    -- Metadata
    metadata JSONB DEFAULT '{}',

    CONSTRAINT valid_wallet_address CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    CONSTRAINT valid_kyc_status CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected', 'expired'))
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- DOMAINS TABLE
-- ============================================================================
-- Stores domain registration information (mirrors on-chain data with additional metadata)
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain_name VARCHAR(253) NOT NULL, -- e.g., "example"
    tld VARCHAR(63) NOT NULL, -- e.g., "web3"
    full_domain VARCHAR(317) GENERATED ALWAYS AS (domain_name || '.' || tld) STORED,

    -- On-chain data (synced from smart contract)
    owner_wallet VARCHAR(42) NOT NULL,
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP, -- NULL = never expires
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Off-chain metadata
    content_hash VARCHAR(100), -- IPFS/Arweave hash
    resolved_address VARCHAR(42), -- Resolved wallet address

    -- Transaction tracking
    registration_tx_hash VARCHAR(66), -- Ethereum transaction hash
    blockchain_sync_status VARCHAR(20) DEFAULT 'pending', -- pending, synced, failed
    blockchain_synced_at TIMESTAMP,

    -- Status tracking
    verification_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    verification_notes TEXT,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_owner_wallet CHECK (owner_wallet ~ '^0x[a-fA-F0-9]{40}$'),
    CONSTRAINT valid_blockchain_sync CHECK (blockchain_sync_status IN ('pending', 'synced', 'failed')),
    CONSTRAINT valid_verification CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT unique_domain UNIQUE (domain_name, tld)
);

CREATE INDEX idx_domains_user ON domains(user_id);
CREATE INDEX idx_domains_full ON domains(full_domain);
CREATE INDEX idx_domains_owner ON domains(owner_wallet);
CREATE INDEX idx_domains_status ON domains(is_active, verification_status);
CREATE INDEX idx_domains_registered ON domains(registered_at);
CREATE INDEX idx_domains_expires ON domains(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
-- Stores payment information for paid domains
-- COMPLIANCE: PCI DSS - No credit card details stored, only Stripe IDs
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,

    -- Payment provider details
    provider VARCHAR(20) NOT NULL DEFAULT 'stripe', -- stripe, crypto
    provider_payment_id VARCHAR(255) NOT NULL, -- Stripe PaymentIntent ID or crypto tx hash
    provider_customer_id VARCHAR(255), -- Stripe Customer ID

    -- Payment details
    amount DECIMAL(18, 8) NOT NULL, -- Amount in smallest unit (cents for USD, wei for ETH)
    currency VARCHAR(10) NOT NULL, -- USD, ETH, BTC, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, refunded

    -- Payment metadata
    payment_method_type VARCHAR(50), -- card, bank_transfer, crypto_wallet
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    refunded_at TIMESTAMP,

    CONSTRAINT valid_provider CHECK (provider IN ('stripe', 'crypto', 'bank_transfer')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'canceled')),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_domain ON payments(domain_id);
CREATE INDEX idx_payments_provider ON payments(provider, provider_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);

-- ============================================================================
-- PROFIT VERIFICATIONS TABLE
-- ============================================================================
-- Stores profit verification requests for paid domain eligibility
-- COMPLIANCE: GDPR - Financial data encrypted, can be deleted on request
CREATE TABLE profit_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,

    -- Verification type
    verification_type VARCHAR(50) NOT NULL, -- income_statement, stripe_atlas, accounting_api, manual

    -- Submitted documents (encrypted references, not actual files)
    document_urls JSONB DEFAULT '[]', -- Array of encrypted S3/storage URLs
    document_hashes JSONB DEFAULT '[]', -- SHA-256 hashes for integrity

    -- Profit threshold information (encrypted)
    reported_revenue DECIMAL(18, 2), -- Encrypted in application layer
    reported_profit DECIMAL(18, 2), -- Encrypted in application layer
    reporting_period_start DATE,
    reporting_period_end DATE,
    currency VARCHAR(10) DEFAULT 'USD',

    -- Verification status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, under_review, approved, rejected, additional_info_needed
    reviewed_by UUID REFERENCES users(id), -- Admin/reviewer user ID
    review_notes TEXT, -- Encrypted notes about the verification

    -- Automated verification
    stripe_account_id VARCHAR(255), -- For Stripe Atlas verification
    stripe_verification_status VARCHAR(50),
    automated_check_passed BOOLEAN,
    automated_check_details JSONB DEFAULT '{}',

    -- Timestamps
    submitted_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_verification_type CHECK (verification_type IN
        ('income_statement', 'stripe_atlas', 'accounting_api', 'manual', 'tax_return')),
    CONSTRAINT valid_status CHECK (status IN
        ('pending', 'under_review', 'approved', 'rejected', 'additional_info_needed', 'expired'))
);

CREATE INDEX idx_profit_verifications_user ON profit_verifications(user_id);
CREATE INDEX idx_profit_verifications_domain ON profit_verifications(domain_id);
CREATE INDEX idx_profit_verifications_status ON profit_verifications(status);
CREATE INDEX idx_profit_verifications_submitted ON profit_verifications(submitted_at);

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
-- Comprehensive audit trail for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Actor information
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    wallet_address VARCHAR(42),
    ip_address INET,
    user_agent TEXT,

    -- Action details
    action_type VARCHAR(50) NOT NULL, -- domain_register, domain_transfer, payment_made, verification_submitted, etc.
    resource_type VARCHAR(50), -- domain, payment, user, verification
    resource_id UUID,

    -- Action details
    action_status VARCHAR(20) NOT NULL, -- success, failure, pending
    description TEXT,

    -- Request/response details (sanitized, no sensitive data)
    request_data JSONB DEFAULT '{}',
    response_data JSONB DEFAULT '{}',
    error_message TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_action_status CHECK (action_status IN ('success', 'failure', 'pending'))
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_wallet ON audit_logs(wallet_address);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_status ON audit_logs(action_status);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- User notifications for domain approvals, payments, etc.
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification details
    type VARCHAR(50) NOT NULL, -- domain_approved, payment_required, verification_needed, etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,

    -- Related resources
    resource_type VARCHAR(50), -- domain, payment, verification
    resource_id UUID,

    -- Action link
    action_url VARCHAR(500),
    action_label VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================================================
-- RATE LIMITING TABLE
-- ============================================================================
-- Track API request rates for rate limiting and abuse prevention
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identifier (IP address, wallet address, or user ID)
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL, -- ip, wallet, user

    -- Rate limit tracking
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    window_end TIMESTAMP NOT NULL,

    -- Blocking
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMP,
    block_reason TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_identifier_type CHECK (identifier_type IN ('ip', 'wallet', 'user')),
    CONSTRAINT unique_rate_limit UNIQUE (identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier, identifier_type);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_end) WHERE is_blocked = FALSE;
CREATE INDEX idx_rate_limits_blocked ON rate_limits(is_blocked, blocked_until);

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
-- User authentication sessions with Web3 wallet signatures
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,

    -- Session token
    session_token VARCHAR(255) NOT NULL UNIQUE,
    refresh_token VARCHAR(255) UNIQUE,

    -- Authentication details
    signature VARCHAR(132) NOT NULL, -- Ethereum signature
    message TEXT NOT NULL, -- Message that was signed
    nonce VARCHAR(64) NOT NULL, -- Random nonce for replay protection

    -- Session metadata
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT NOW(),

    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE is_active = TRUE;

-- ============================================================================
-- WEBHOOK EVENTS TABLE
-- ============================================================================
-- Track incoming webhook events from Stripe and other services
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Provider details
    provider VARCHAR(50) NOT NULL, -- stripe, coinbase, etc.
    event_id VARCHAR(255) NOT NULL, -- Provider's event ID
    event_type VARCHAR(100) NOT NULL,

    -- Event data
    payload JSONB NOT NULL,

    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processed, failed, ignored
    processed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Related resources
    related_payment_id UUID REFERENCES payments(id),
    related_user_id UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
    CONSTRAINT unique_webhook_event UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhook_events_provider ON webhook_events(provider, event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profit_verifications_updated_at BEFORE UPDATE ON profit_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW() AND is_active = TRUE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for active domains with user information
CREATE OR REPLACE VIEW active_domains AS
SELECT
    d.id,
    d.domain_name,
    d.tld,
    d.full_domain,
    d.owner_wallet,
    u.email,
    u.wallet_address,
    d.registered_at,
    d.expires_at,
    d.is_paid,
    d.verification_status,
    d.content_hash,
    d.resolved_address
FROM domains d
JOIN users u ON d.user_id = u.id
WHERE d.is_active = TRUE
    AND (d.expires_at IS NULL OR d.expires_at > NOW());

-- View for pending verifications
CREATE OR REPLACE VIEW pending_verifications AS
SELECT
    pv.id,
    pv.user_id,
    u.wallet_address,
    u.email,
    d.full_domain,
    pv.verification_type,
    pv.status,
    pv.submitted_at,
    pv.reported_revenue,
    pv.reported_profit,
    pv.currency
FROM profit_verifications pv
JOIN users u ON pv.user_id = u.id
LEFT JOIN domains d ON pv.domain_id = d.id
WHERE pv.status IN ('pending', 'under_review', 'additional_info_needed');

-- View for user dashboard statistics
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT
    u.id AS user_id,
    u.wallet_address,
    u.email,
    COUNT(DISTINCT d.id) AS total_domains,
    COUNT(DISTINCT d.id) FILTER (WHERE d.is_paid = FALSE) AS free_domains,
    COUNT(DISTINCT d.id) FILTER (WHERE d.is_paid = TRUE) AS paid_domains,
    COUNT(DISTINCT p.id) AS total_payments,
    SUM(p.amount) FILTER (WHERE p.status = 'succeeded') AS total_spent,
    COUNT(DISTINCT pv.id) AS verification_requests,
    COUNT(DISTINCT pv.id) FILTER (WHERE pv.status = 'approved') AS approved_verifications
FROM users u
LEFT JOIN domains d ON u.id = d.user_id AND d.is_active = TRUE
LEFT JOIN payments p ON u.id = p.user_id
LEFT JOIN profit_verifications pv ON u.id = pv.user_id
GROUP BY u.id, u.wallet_address, u.email;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert system admin user (optional - for testing)
-- NOTE: Replace with actual admin wallet address
-- INSERT INTO users (wallet_address, email, kyc_status, is_active)
-- VALUES ('0x0000000000000000000000000000000000000001', 'admin@web3domains.com', 'approved', TRUE)
-- ON CONFLICT (wallet_address) DO NOTHING;

-- ============================================================================
-- MAINTENANCE TASKS
-- ============================================================================

-- Create a scheduled job to clean up expired sessions daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions()');
-- SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', 'SELECT cleanup_old_rate_limits()');

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Create application user (run these commands separately with appropriate credentials)
-- CREATE USER web3domains_app WITH PASSWORD 'strong_password_here';
-- GRANT CONNECT ON DATABASE web3domains TO web3domains_app;
-- GRANT USAGE ON SCHEMA public TO web3domains_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO web3domains_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web3domains_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO web3domains_app;

-- ============================================================================
-- BACKUP AND RECOVERY NOTES
-- ============================================================================
--
-- Daily backups recommended:
-- pg_dump -Fc web3domains > backup_$(date +%Y%m%d).dump
--
-- Point-in-time recovery:
-- Enable WAL archiving in postgresql.conf:
-- wal_level = replica
-- archive_mode = on
-- archive_command = 'cp %p /path/to/archive/%f'
--
-- Restore from backup:
-- pg_restore -d web3domains backup_20240101.dump
--
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts linked to Ethereum wallet addresses';
COMMENT ON TABLE domains IS 'Domain registrations with on-chain and off-chain metadata';
COMMENT ON TABLE payments IS 'Payment records for domain registrations (PCI DSS compliant)';
COMMENT ON TABLE profit_verifications IS 'Profit verification requests for paid domain eligibility';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance';
COMMENT ON TABLE notifications IS 'User notifications for important events';
COMMENT ON TABLE rate_limits IS 'API rate limiting and abuse prevention';
COMMENT ON TABLE sessions IS 'Web3 wallet authentication sessions';
COMMENT ON TABLE webhook_events IS 'Incoming webhook events from external services';
