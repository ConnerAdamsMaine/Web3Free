import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { useWeb3 } from '../context/Web3Context';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const DashboardPage = () => {
  const { isConnected } = useWeb3();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  // Token stats
  const [tokenStats, setTokenStats] = useState({
    balance: 1248.75,
    staked: 850.00,
    earned: 342.50,
    browseRewards: 156.25,
    stakingRewards: 186.25
  });

  useEffect(() => {
    if (!isConnected) {
      navigate('/');
      return;
    }

    fetchDashboard();
  }, [isConnected, navigate]);

  const fetchDashboard = async () => {
    try {
      const [dashboardRes, domainsRes] = await Promise.all([
        axios.get(`${API_URL}/users/dashboard`),
        axios.get(`${API_URL}/domains/my-domains`),
      ]);

      setDashboard(dashboardRes.data.data);
      setDomains(domainsRes.data.data.domains || []);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-6xl"
        >
          ⚙️
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
            My Dashboard
          </h1>
          <p className="text-purple-300">Track your domains, earnings, and staking rewards</p>
        </motion.div>

        {/* W3B Token Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            className="glass-card glow-purple"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-purple-300 text-sm font-semibold">Total Balance</span>
              <motion.span
                className="text-2xl"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                💎
              </motion.span>
            </div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
              <CountUp end={tokenStats.balance} duration={2} decimals={2} separator="," />
            </div>
            <div className="text-sm text-purple-400">W3B Tokens</div>
          </motion.div>

          <motion.div
            className="glass-card glow-green"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-300 text-sm font-semibold">Staked</span>
              <motion.span
                className="text-2xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🔒
              </motion.span>
            </div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mb-2">
              <CountUp end={tokenStats.staked} duration={2} decimals={2} separator="," />
            </div>
            <div className="text-sm text-green-400">Earning 20% APY</div>
          </motion.div>

          <motion.div
            className="glass-card glow-pink"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-pink-300 text-sm font-semibold">Total Earned</span>
              <motion.span
                className="text-2xl"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                📈
              </motion.span>
            </div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-red-400 mb-2">
              <CountUp end={tokenStats.earned} duration={2} decimals={2} separator="," />
            </div>
            <div className="text-sm text-pink-400">All-Time Rewards</div>
          </motion.div>

          <motion.div
            className="glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            style={{ boxShadow: '0 0 30px rgba(234, 179, 8, 0.4)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-yellow-300 text-sm font-semibold">Browse Rewards</span>
              <motion.span
                className="text-2xl"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🌐
              </motion.span>
            </div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-2">
              <CountUp end={tokenStats.browseRewards} duration={2} decimals={2} separator="," />
            </div>
            <div className="text-sm text-yellow-400">From Validation</div>
          </motion.div>
        </div>

        {/* Domain Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {dashboard?.total_domains || 0}
            </div>
            <div className="text-sm text-purple-300">Total Domains</div>
          </div>

          <div className="glass-card text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {dashboard?.free_domains || 0}
            </div>
            <div className="text-sm text-purple-300">Free Domains</div>
          </div>

          <div className="glass-card text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {dashboard?.paid_domains || 0}
            </div>
            <div className="text-sm text-purple-300">Business Domains</div>
          </div>

          <div className="glass-card text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {dashboard?.verification_requests || 0}
            </div>
            <div className="text-sm text-purple-300">Verifications</div>
          </div>
        </div>

        {/* Staking Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div
            className="glass-card"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <motion.span
                className="text-4xl"
                animate={{ rotateY: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                💎
              </motion.span>
              <div>
                <h3 className="text-2xl font-bold text-white">Stake W3B</h3>
                <p className="text-purple-300 text-sm">Earn 20% APY from protocol revenue</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <div className="text-sm text-purple-300 mb-2">Available to Stake</div>
                <div className="text-2xl font-bold text-white">
                  {(tokenStats.balance - tokenStats.staked).toFixed(2)} W3B
                </div>
              </div>

              <input
                type="number"
                placeholder="Amount to stake"
                className="input-modern"
              />

              <button className="btn btn-primary w-full">
                Stake Tokens
              </button>

              <div className="text-xs text-purple-400 text-center">
                No lock-up period • Withdraw anytime • Rewards paid daily
              </div>
            </div>
          </motion.div>

          <motion.div
            className="glass-card"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <motion.span
                className="text-4xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                📊
              </motion.span>
              <div>
                <h3 className="text-2xl font-bold text-white">Staking Stats</h3>
                <p className="text-purple-300 text-sm">Your staking performance</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-purple-300">Currently Staked</span>
                <span className="text-white font-bold">{tokenStats.staked} W3B</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-purple-300">Staking Rewards Earned</span>
                <span className="text-green-400 font-bold">+{tokenStats.stakingRewards} W3B</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-purple-300">Current APY</span>
                <span className="text-yellow-400 font-bold">20%</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-purple-300">Next Reward In</span>
                <span className="text-purple-400">12h 34m</span>
              </div>

              <button className="btn btn-secondary w-full">
                Claim Rewards
              </button>
            </div>
          </motion.div>
        </div>

        {/* My Domains */}
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <span>🌐</span>
            My Domains
          </h2>

          {domains.length === 0 ? (
            <div className="text-center py-12">
              <motion.div
                className="text-6xl mb-4"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                📦
              </motion.div>
              <p className="text-purple-300 mb-4">
                No domains yet. Register your first domain to get started!
              </p>
              <a href="/search" className="btn btn-primary">
                Search Domains
              </a>
            </div>
          ) : (
            <div className="grid gap-4">
              {domains.map((domain, index) => (
                <motion.div
                  key={domain.id}
                  className="glass-card hover:scale-[1.02] transition-all"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-white">
                          {domain.full_domain}
                        </h3>
                        <span
                          className={`badge ${
                            domain.is_active ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {domain.is_active ? '✓ Active' : '⏳ Pending'}
                        </span>
                        <span className="badge badge-info">
                          {domain.is_paid ? '💼 Business' : '🆓 Free'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-purple-400">Type:</span>
                          <p className="text-white">
                            {domain.is_paid ? 'Self-hosted' : 'Centralized DNS'}
                          </p>
                        </div>
                        <div>
                          <span className="text-purple-400">Registered:</span>
                          <p className="text-white">
                            {new Date(domain.registered_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-purple-400">Status:</span>
                          <p className="text-white">{domain.verification_status}</p>
                        </div>
                      </div>
                    </div>

                    {!domain.is_active && domain.is_paid && (
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          (window.location.href = `/payment/${domain.id}`)
                        }
                      >
                        Complete Payment
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
