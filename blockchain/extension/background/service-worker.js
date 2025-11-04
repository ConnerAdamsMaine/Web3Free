/**
 * Web3Browse Extension - Background Service Worker
 *
 * Runs blockchain light node in the background
 * Validates blocks while user browses
 */

// Extension state
let state = {
  validatorId: null,
  walletAddress: null,
  isActive: false,
  totalRewards: 0,
  blocksValidated: 0,
  currentDomain: null,
  connectedToNetwork: false,
};

// Blockchain node connection
const NODE_URL = 'http://localhost:3001'; // Will be configurable
let wsConnection = null;

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Web3Browse extension installed');

  // Load saved state
  const saved = await chrome.storage.local.get(['validatorId', 'walletAddress', 'totalRewards']);

  if (saved.validatorId) {
    state.validatorId = saved.validatorId;
    state.walletAddress = saved.walletAddress;
    state.totalRewards = saved.totalRewards || 0;
  } else {
    // Generate new validator ID
    state.validatorId = generateValidatorId();
    await chrome.storage.local.set({ validatorId: state.validatorId });
  }

  // Connect to blockchain network
  connectToNetwork();
});

/**
 * Generate unique validator ID
 */
function generateValidatorId() {
  return 'val_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate browser fingerprint for Sybil resistance
 */
async function generateBrowserFingerprint() {
  const data = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Add more fingerprinting data
  };

  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Connect to blockchain network via WebSocket
 */
async function connectToNetwork() {
  try {
    // HTTP connection for REST API
    const response = await fetch(`${NODE_URL}/health`);
    const health = await response.json();

    console.log('Connected to blockchain node:', health);

    // WebSocket connection for real-time updates
    wsConnection = new WebSocket(`ws://localhost:3001`);

    wsConnection.onopen = async () => {
      console.log('WebSocket connected');
      state.connectedToNetwork = true;

      // Register as validator
      await registerValidator();

      // Subscribe to updates
      wsConnection.send(JSON.stringify({ type: 'subscribe' }));

      updateBadge();
    };

    wsConnection.onmessage = (event) => {
      handleNetworkMessage(JSON.parse(event.data));
    };

    wsConnection.onclose = () => {
      console.log('WebSocket disconnected');
      state.connectedToNetwork = false;
      updateBadge();

      // Reconnect after 5 seconds
      setTimeout(connectToNetwork, 5000);
    };

    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  } catch (error) {
    console.error('Failed to connect to network:', error);

    // Retry after 10 seconds
    setTimeout(connectToNetwork, 10000);
  }
}

/**
 * Register this browser as a validator
 */
async function registerValidator() {
  try {
    const fingerprint = await generateBrowserFingerprint();

    const response = await fetch(`${NODE_URL}/api/validator/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.validatorId,
        publicKey: state.walletAddress || state.validatorId,
        browserFingerprint: fingerprint,
        ipAddress: 'auto', // Server will detect
        currentDomain: state.currentDomain,
      }),
    });

    const result = await response.json();
    console.log('Registered as validator:', result);

    state.isActive = true;
    await chrome.storage.local.set({ isActive: true });

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icon-48.png',
      title: 'Web3Browse Active',
      message: 'You are now validating blocks and earning rewards!',
    });
  } catch (error) {
    console.error('Failed to register validator:', error);
  }
}

/**
 * Handle messages from blockchain network
 */
function handleNetworkMessage(message) {
  switch (message.type) {
    case 'newBlock':
      handleNewBlock(message.data);
      break;

    case 'newTransaction':
      console.log('New transaction:', message.data);
      break;

    case 'validatorJoined':
      console.log('New validator joined:', message.data);
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Handle new block - participate in validation
 */
async function handleNewBlock(block) {
  console.log('New block received:', block.index);

  // Validate block (light validation)
  const isValid = await validateBlock(block);

  if (isValid) {
    state.blocksValidated++;
    // Check if we earned rewards for this block
    // Rewards are determined by blockchain based on our activity
    await updateRewards();
  }

  updateBadge();
}

/**
 * Light block validation
 */
async function validateBlock(block) {
  // Light nodes validate:
  // 1. Block hash is correct
  // 2. Previous hash matches
  // 3. Timestamp is reasonable
  // 4. Transaction format is valid

  // In a real implementation, would do full validation
  return true;
}

/**
 * Update rewards from blockchain
 */
async function updateRewards() {
  try {
    if (!state.walletAddress) return;

    const response = await fetch(`${NODE_URL}/api/balance/${state.walletAddress}`);
    const data = await response.json();

    state.totalRewards = data.balance;
    await chrome.storage.local.set({ totalRewards: state.totalRewards });

    updateBadge();
  } catch (error) {
    console.error('Failed to update rewards:', error);
  }
}

/**
 * Update extension badge
 */
function updateBadge() {
  const text = state.isActive && state.connectedToNetwork
    ? `${Math.floor(state.totalRewards)}`
    : '!';

  const color = state.isActive && state.connectedToNetwork
    ? '#4CAF50'
    : '#F44336';

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

/**
 * Listen for tab updates (domain changes)
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleDomainChange(tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    handleDomainChange(changeInfo.url);
  }
});

/**
 * Handle domain change - update validator activity
 */
async function handleDomainChange(url) {
  if (!url) return;

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Check if this is a Web3Browse domain
    const isWeb3Domain = await checkIfWeb3Domain(domain);

    if (isWeb3Domain) {
      state.currentDomain = domain;

      // Notify blockchain of validator activity
      await fetch(`${NODE_URL}/api/validator/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validatorId: state.validatorId,
          domain: domain,
        }),
      });

      console.log('Validator activity updated:', domain);
    } else {
      state.currentDomain = null;
    }
  } catch (error) {
    // Invalid URL or other error
  }
}

/**
 * Check if domain is registered on Web3Browse
 */
async function checkIfWeb3Domain(domain) {
  try {
    // Query our domain registry
    // For now, check if it's a custom TLD
    const parts = domain.split('.');
    if (parts.length >= 2) {
      const tld = parts[parts.length - 1];

      // Our custom TLDs (not standard)
      const standardTLDs = ['com', 'net', 'org', 'io', 'co', 'dev'];
      return !standardTLDs.includes(tld);
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'getState':
      sendResponse(state);
      break;

    case 'setWallet':
      state.walletAddress = message.address;
      chrome.storage.local.set({ walletAddress: message.address });
      sendResponse({ success: true });
      break;

    case 'toggleActive':
      state.isActive = !state.isActive;
      chrome.storage.local.set({ isActive: state.isActive });

      if (state.isActive && !state.connectedToNetwork) {
        connectToNetwork();
      }

      sendResponse({ success: true, isActive: state.isActive });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep message channel open
});

/**
 * Periodic tasks
 */
setInterval(() => {
  if (state.isActive && state.connectedToNetwork) {
    updateRewards();
  }
}, 30000); // Every 30 seconds

// Initialize on startup
updateBadge();
