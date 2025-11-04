import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';

const HomePage = () => {
  const { connectWallet, isConnected } = useWeb3();

  return (
    <div className="container" style={styles.container}>
      <div style={styles.hero}>
        <h1 style={styles.title}>Web3 Domain Registry</h1>
        <p style={styles.subtitle}>
          Register custom blockchain domains with your own TLDs
        </p>

        <div style={styles.features}>
          <div className="card" style={styles.featureCard}>
            <h3>🆓 Free First Domain</h3>
            <p>Every wallet gets one free domain hosted on our centralized DNS</p>
          </div>
          <div className="card" style={styles.featureCard}>
            <h3>💼 Business Domains</h3>
            <p>Self-hosted domains with profit verification for businesses</p>
          </div>
          <div className="card" style={styles.featureCard}>
            <h3>🔒 Blockchain Secured</h3>
            <p>Ownership verified on Ethereum blockchain</p>
          </div>
        </div>

        <div style={styles.cta}>
          {isConnected ? (
            <Link to="/search" className="btn btn-primary" style={styles.ctaBtn}>
              Search Domains
            </Link>
          ) : (
            <button onClick={connectWallet} className="btn btn-primary" style={styles.ctaBtn}>
              Connect Wallet to Get Started
            </button>
          )}
        </div>

        <div className="card" style={styles.infoCard}>
          <h2>How It Works</h2>
          <ol style={styles.steps}>
            <li>Connect your Web3 wallet (MetaMask)</li>
            <li>Search for available domains with custom TLDs</li>
            <li>Register your first domain for FREE (hosted by us)</li>
            <li>Additional domains require profit verification for self-hosting</li>
            <li>Pay securely via Stripe for business domains</li>
            <li>Manage your domains from the dashboard</li>
          </ol>
        </div>

        <div className="card" style={styles.infoCard}>
          <h2>Hosting Model</h2>
          <div style={styles.hostingInfo}>
            <div>
              <h3>🏠 Free/Hobbyist Domains</h3>
              <ul>
                <li>Hosted on our centralized DNS</li>
                <li>One free domain per wallet</li>
                <li>Perfect for personal projects</li>
                <li>Instant activation</li>
              </ul>
            </div>
            <div>
              <h3>🚀 Business/Paid Domains</h3>
              <ul>
                <li>Self-hosted by you</li>
                <li>Requires profit verification (>${process.env.REACT_APP_PROFIT_THRESHOLD || '10,000'})</li>
                <li>We provide verification/authentication</li>
                <li>Full control over your infrastructure</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    paddingTop: '40px',
    paddingBottom: '80px',
  },
  hero: {
    textAlign: 'center',
  },
  title: {
    fontSize: '48px',
    fontWeight: '700',
    color: 'white',
    marginBottom: '16px',
  },
  subtitle: {
    fontSize: '24px',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '48px',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '48px',
  },
  featureCard: {
    textAlign: 'center',
  },
  cta: {
    marginBottom: '48px',
  },
  ctaBtn: {
    fontSize: '18px',
    padding: '16px 32px',
  },
  infoCard: {
    textAlign: 'left',
    maxWidth: '800px',
    margin: '0 auto 24px',
  },
  steps: {
    paddingLeft: '24px',
    lineHeight: '1.8',
  },
  hostingInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginTop: '24px',
  },
};

export default HomePage;
