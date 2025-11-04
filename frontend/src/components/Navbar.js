import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { useWeb3 } from '../context/Web3Context';

const Navbar = () => {
  const { isConnected, account, connectWallet, disconnectWallet, loading } = useWeb3();
  const [w3bBalance, setW3bBalance] = useState(1248.75);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <motion.nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/40 backdrop-blur-2xl border-b border-white/10'
          : 'bg-transparent'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-purple-500/50"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              🌐
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 group-hover:from-pink-400 group-hover:to-purple-400 transition-all">
                Web3Browse
              </h2>
              <p className="text-xs text-purple-400/80 -mt-1">Powered by W3B</p>
            </div>
          </Link>

          {/* Center Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/search"
              className="text-purple-200 hover:text-white transition-colors font-semibold flex items-center gap-2 group"
            >
              <motion.span
                whileHover={{ scale: 1.2, rotate: 5 }}
              >
                🔍
              </motion.span>
              Search
            </Link>
            {isConnected && (
              <Link
                to="/dashboard"
                className="text-purple-200 hover:text-white transition-colors font-semibold flex items-center gap-2 group"
              >
                <motion.span
                  whileHover={{ scale: 1.2 }}
                >
                  📊
                </motion.span>
                Dashboard
              </Link>
            )}
            <a
              href="#tokenomics"
              className="text-purple-200 hover:text-white transition-colors font-semibold flex items-center gap-2"
            >
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                💎
              </motion.span>
              W3B Token
            </a>
          </div>

          {/* Right side - Wallet & Balance */}
          <div className="flex items-center gap-4">
            {isConnected ? (
              <>
                {/* W3B Balance */}
                <motion.div
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-xl backdrop-blur-sm glow-purple"
                  whileHover={{ scale: 1.05 }}
                >
                  <motion.span
                    className="text-2xl"
                    animate={{
                      rotate: [0, 360]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  >
                    💎
                  </motion.span>
                  <div className="flex flex-col">
                    <span className="text-xs text-purple-300">W3B Balance</span>
                    <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                      <CountUp end={w3bBalance} duration={1.5} decimals={2} separator="," />
                    </span>
                  </div>
                </motion.div>

                {/* Wallet Address */}
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg font-mono text-sm text-purple-300">
                    {formatAddress(account)}
                  </div>

                  <motion.button
                    onClick={disconnectWallet}
                    className="btn btn-ghost text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Disconnect
                  </motion.button>
                </div>
              </>
            ) : (
              <motion.button
                onClick={connectWallet}
                className="btn btn-primary"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      ⚙️
                    </motion.span>
                    Connecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🚀 Connect Wallet
                  </span>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Mobile menu links */}
        <div className="md:hidden flex gap-4 mt-4 pt-4 border-t border-white/10">
          <Link
            to="/search"
            className="text-purple-200 hover:text-white transition-colors text-sm font-semibold"
          >
            🔍 Search
          </Link>
          {isConnected && (
            <Link
              to="/dashboard"
              className="text-purple-200 hover:text-white transition-colors text-sm font-semibold"
            >
              📊 Dashboard
            </Link>
          )}
          <a
            href="#tokenomics"
            className="text-purple-200 hover:text-white transition-colors text-sm font-semibold"
          >
            💎 Token
          </a>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
