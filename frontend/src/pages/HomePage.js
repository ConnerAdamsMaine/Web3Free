import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { useWeb3 } from '../context/Web3Context';

const HomePage = () => {
  const { connectWallet, isConnected } = useWeb3();
  const [stats, setStats] = useState({
    totalDomains: 12847,
    tokensBurned: 125430,
    activeValidators: 3421,
    w3bPrice: 0.42
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto">
          {/* Main Hero */}
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-full text-sm font-semibold text-purple-300 backdrop-blur-sm">
                🚀 Powered by Proof of Browse Consensus
              </span>
            </div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 animate-gradient bg-[length:200%_auto]">
              Browse. Earn. Own.
            </h1>

            <p className="text-2xl md:text-3xl text-purple-200 mb-4 font-light">
              Turn Your Browser Into a Blockchain Validator
            </p>

            <p className="text-lg text-purple-300/80 max-w-3xl mx-auto mb-8">
              Register custom Web3 domains and earn <span className="text-pink-400 font-semibold">W3B tokens</span> just by browsing.
              Every visit validates transactions. No mining rigs. No staking lockups. Just browse and earn.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              {isConnected ? (
                <>
                  <Link to="/search" className="btn btn-primary text-lg px-8 py-4 glow-purple">
                    🔍 Search Domains
                  </Link>
                  <Link to="/dashboard" className="btn btn-ghost text-lg px-8 py-4">
                    📊 My Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <button onClick={connectWallet} className="btn btn-primary text-lg px-8 py-4 glow-purple">
                    🚀 Start Earning Now
                  </button>
                  <a href="#how-it-works" className="btn btn-ghost text-lg px-8 py-4">
                    📖 Learn More
                  </a>
                </>
              )}
            </div>

            {/* Live Stats with Rolling Numbers */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                className="glass-card text-center hover:scale-110 transition-all duration-300 glow-purple"
                variants={itemVariants}
                whileHover={{ scale: 1.1, rotate: 2 }}
              >
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                  <CountUp end={stats.totalDomains} duration={2.5} separator="," />
                </div>
                <div className="text-sm text-purple-300 mt-1">Domains Registered</div>
              </motion.div>

              <motion.div
                className="glass-card text-center hover:scale-110 transition-all duration-300 glow-pink"
                variants={itemVariants}
                whileHover={{ scale: 1.1, rotate: -2 }}
              >
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-red-400 flex items-center justify-center gap-2">
                  <CountUp end={stats.tokensBurned} duration={2.5} separator="," />
                  <motion.span
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    🔥
                  </motion.span>
                </div>
                <div className="text-sm text-purple-300 mt-1">W3B Burned</div>
              </motion.div>

              <motion.div
                className="glass-card text-center hover:scale-110 transition-all duration-300 glow-green"
                variants={itemVariants}
                whileHover={{ scale: 1.1, rotate: 2 }}
              >
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                  <CountUp end={stats.activeValidators} duration={2.5} separator="," />
                </div>
                <div className="text-sm text-purple-300 mt-1">Active Validators</div>
              </motion.div>

              <motion.div
                className="glass-card text-center hover:scale-110 transition-all duration-300"
                variants={itemVariants}
                whileHover={{ scale: 1.1, rotate: -2 }}
                style={{
                  boxShadow: '0 0 30px rgba(234, 179, 8, 0.4)'
                }}
              >
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                  $<CountUp end={stats.w3bPrice} duration={2.5} decimals={2} />
                </div>
                <div className="text-sm text-purple-300 mt-1">W3B Price</div>
              </motion.div>
            </motion.div>
          </div>

          {/* Value Props with Enhanced Animations */}
          <motion.div
            className="grid md:grid-cols-3 gap-6 mb-16"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="glass-card cursor-pointer glow-purple relative overflow-hidden"
              variants={itemVariants}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 50px rgba(168,85,247,0.6)",
                borderColor: "rgba(168,85,247,0.8)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative">
                <motion.div
                  className="text-5xl mb-4"
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  🌐
                </motion.div>
                <h3 className="text-2xl font-bold mb-3 text-purple-200">Browse to Earn</h3>
                <p className="text-purple-300/90">
                  Install our Chrome extension and earn W3B tokens automatically while browsing Web3 domains. Your browser becomes a validator node.
                </p>
                <div className="mt-4 px-3 py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/30 rounded-lg inline-block">
                  <div className="text-sm text-pink-400 font-semibold flex items-center gap-2">
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      ✨
                    </motion.span>
                    ~0.1-1 W3B per session
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="glass-card cursor-pointer glow-pink relative overflow-hidden"
              variants={itemVariants}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 50px rgba(236,72,153,0.6)",
                borderColor: "rgba(236,72,153,0.8)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-red-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative">
                <motion.div
                  className="text-5xl mb-4"
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  🔥
                </motion.div>
                <h3 className="text-2xl font-bold mb-3 text-pink-200">Buyback & Burn</h3>
                <p className="text-purple-300/90">
                  50% of all domain revenue buys W3B from the market and burns it forever. Real revenue creates real value.
                </p>
                <div className="mt-4 px-3 py-2 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30 rounded-lg inline-block">
                  <div className="text-sm text-pink-400 font-semibold">
                    Deflationary by design
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="glass-card cursor-pointer glow-green relative overflow-hidden"
              variants={itemVariants}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 50px rgba(34,197,94,0.6)",
                borderColor: "rgba(34,197,94,0.8)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative">
                <motion.div
                  className="text-5xl mb-4"
                  animate={{
                    rotateY: [0, 180, 360],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  💎
                </motion.div>
                <h3 className="text-2xl font-bold mb-3 text-green-200">Stake & Earn</h3>
                <p className="text-purple-300/90">
                  Stake your W3B for 20% APY from real protocol revenue. No inflation. No tricks. Just sustainable yields.
                </p>
                <div className="mt-4 px-3 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-lg inline-block">
                  <div className="text-sm text-green-400 font-semibold flex items-center gap-2">
                    <motion.span
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      📈
                    </motion.span>
                    20% APY from revenue
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
            How It Works
          </h2>
          <p className="text-center text-purple-300 mb-12 text-lg">
            Start earning W3B tokens in 3 simple steps
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-card text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Install Extension</h3>
              <p className="text-purple-300">
                Add our Chrome extension to turn your browser into a blockchain light node. Takes 30 seconds.
              </p>
            </div>

            <div className="glass-card text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-red-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Browse Domains</h3>
              <p className="text-purple-300">
                Visit any Web3 domain registered on our network. Each visit validates transactions and secures the blockchain.
              </p>
            </div>

            <div className="glass-card text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Earn Rewards</h3>
              <p className="text-purple-300">
                Automatically receive W3B tokens for your validation work. Stake for 20% APY or use for domains.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Token Economics */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
            Real Value, Real Tokenomics
          </h2>
          <p className="text-center text-purple-300 mb-12 text-lg">
            W3B tokens are backed by actual revenue, not speculation
          </p>

          <div className="glass-card max-w-4xl mx-auto mb-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">💰</div>
              <h3 className="text-3xl font-bold mb-4 text-white">Revenue → Buyback → Burn</h3>
              <p className="text-purple-300 text-lg">
                Every domain registration creates real value for token holders
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
                <h4 className="font-bold text-xl mb-3 text-purple-200">Revenue Distribution</h4>
                <ul className="space-y-2 text-purple-300">
                  <li className="flex justify-between"><span>Buyback & Burn</span><span className="text-pink-400 font-semibold">50%</span></li>
                  <li className="flex justify-between"><span>Staking Rewards</span><span className="text-green-400 font-semibold">25%</span></li>
                  <li className="flex justify-between"><span>Treasury</span><span className="text-blue-400 font-semibold">25%</span></li>
                </ul>
              </div>

              <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-6">
                <h4 className="font-bold text-xl mb-3 text-pink-200">Value Drivers</h4>
                <ul className="space-y-2 text-purple-300">
                  <li>✅ Mandatory utility for domains</li>
                  <li>🔥 50% of supply burned forever</li>
                  <li>📈 20% staking APY from revenue</li>
                  <li>🌐 Network effects compound</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center">
            <a
              href="https://github.com/yourusername/web3free/blob/main/blockchain/TOKENOMICS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              📄 Read Full Tokenomics
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-white">
            Why Choose Web3Browse?
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card">
              <div className="text-4xl mb-3">🆓</div>
              <h3 className="text-xl font-bold mb-2 text-white">Free First Domain</h3>
              <p className="text-purple-300 text-sm">
                Every wallet gets one free domain to get started
              </p>
            </div>

            <div className="glass-card">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-xl font-bold mb-2 text-white">3-Second Blocks</h3>
              <p className="text-purple-300 text-sm">
                Lightning-fast domain resolution on Web3Browse chain
              </p>
            </div>

            <div className="glass-card">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-xl font-bold mb-2 text-white">Ethereum Secured</h3>
              <p className="text-purple-300 text-sm">
                Domain ownership recorded immutably on Ethereum
              </p>
            </div>

            <div className="glass-card">
              <div className="text-4xl mb-3">🎨</div>
              <h3 className="text-xl font-bold mb-2 text-white">Custom TLDs</h3>
              <p className="text-purple-300 text-sm">
                Create your own .brand, .dao, or any TLD you want
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-card glow-purple">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to Start Earning?
            </h2>
            <p className="text-xl text-purple-300 mb-8">
              Join thousands of users already earning W3B tokens by browsing
            </p>

            {isConnected ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/search" className="btn btn-primary text-lg px-8 py-4">
                  Register Your Domain
                </Link>
                <a
                  href="https://chrome.google.com/webstore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-lg px-8 py-4"
                >
                  Install Extension
                </a>
              </div>
            ) : (
              <button onClick={connectWallet} className="btn btn-primary text-lg px-8 py-4">
                Connect Wallet & Get Started
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
