import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';

const Navbar = () => {
  const { isConnected, account, connectWallet, disconnectWallet, loading } = useWeb3();

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <nav style={styles.nav}>
      <div className="container" style={styles.navContainer}>
        <Link to="/" style={styles.logo}>
          <h2>Web3 Domains</h2>
        </Link>

        <div style={styles.navLinks}>
          <Link to="/search" style={styles.link}>
            Search Domains
          </Link>
          {isConnected && (
            <Link to="/dashboard" style={styles.link}>
              Dashboard
            </Link>
          )}
        </div>

        <div>
          {isConnected ? (
            <div style={styles.accountInfo}>
              <span style={styles.address}>{formatAddress(account)}</span>
              <button
                onClick={disconnectWallet}
                className="btn btn-secondary"
                style={styles.btn}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="btn btn-primary"
              disabled={loading}
              style={styles.btn}
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    padding: '16px 0',
  },
  navContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    textDecoration: 'none',
    color: '#667eea',
  },
  navLinks: {
    display: 'flex',
    gap: '24px',
  },
  link: {
    textDecoration: 'none',
    color: '#4a5568',
    fontWeight: '600',
    transition: 'color 0.3s',
  },
  accountInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  address: {
    background: '#f7fafc',
    padding: '8px 16px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  btn: {
    margin: 0,
  },
};

export default Navbar;
