import React, { createContext, useState, useEffect, useContext } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

const Web3Context = createContext();

export const useWeb3 = () => useContext(Web3Context);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window.ethereum !== 'undefined';
  };

  // Connect wallet
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      toast.error('Please install MetaMask to use this app');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setLoading(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));

      // Authenticate with backend
      await authenticateUser(accounts[0], signer);

      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  // Authenticate user with backend
  const authenticateUser = async (walletAddress, signer) => {
    try {
      // Get nonce
      const nonceResponse = await axios.get(`${API_URL}/auth/nonce/${walletAddress}`);
      const { message, nonce } = nonceResponse.data;

      // Sign message
      const signature = await signer.signMessage(message);

      // Login
      const loginResponse = await axios.post(`${API_URL}/auth/login`, {
        walletAddress,
        signature,
        message,
        nonce,
      });

      const { token: newToken, user } = loginResponse.data;

      // Store token
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(user);
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    toast.success('Wallet disconnected');
  };

  // Handle account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== account) {
        setAccount(accounts[0]);
        toast.info('Account changed');
      }
    };

    const handleChainChanged = (chainId) => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account]);

  // Auto-connect on mount if token exists
  useEffect(() => {
    const autoConnect = async () => {
      if (token && isMetaMaskInstalled()) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send('eth_accounts', []);

          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            const network = await provider.getNetwork();

            setProvider(provider);
            setSigner(signer);
            setAccount(accounts[0]);
            setChainId(Number(network.chainId));

            // Fetch user data
            const response = await axios.get(`${API_URL}/auth/me`);
            setUser(response.data.user);
          }
        } catch (error) {
          console.error('Auto-connect error:', error);
          localStorage.removeItem('token');
        }
      }
    };

    autoConnect();
  }, []);

  const value = {
    account,
    provider,
    signer,
    chainId,
    user,
    token,
    loading,
    isConnected: !!account,
    connectWallet,
    disconnectWallet,
    isMetaMaskInstalled,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};
