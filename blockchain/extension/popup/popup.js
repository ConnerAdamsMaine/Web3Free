/**
 * Web3Browse Extension - Popup UI
 */

let state = null;

// Initialize
async function init() {
  // Get state from background script
  chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
    state = response;
    updateUI();
  });
}

// Update UI with current state
function updateUI() {
  if (!state) return;

  // Update status indicator
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (state.isActive && state.connectedToNetwork) {
    statusDot.classList.remove('inactive');
    statusText.textContent = 'Active & Validating';
  } else if (state.connectedToNetwork) {
    statusDot.classList.add('inactive');
    statusText.textContent = 'Connected (Inactive)';
  } else {
    statusDot.classList.add('inactive');
    statusText.textContent = 'Disconnected';
  }

  // Update toggle
  document.getElementById('activeToggle').checked = state.isActive;

  // Update stats
  document.getElementById('rewards').textContent = Math.floor(state.totalRewards);
  document.getElementById('blocks').textContent = state.blocksValidated;

  // Update wallet display
  if (state.walletAddress) {
    document.getElementById('walletDisplay').style.display = 'block';
    document.getElementById('walletAddress').textContent = state.walletAddress;
    document.getElementById('connectWallet').textContent = 'Change Wallet';
  }
}

// Connect wallet
document.getElementById('connectWallet').addEventListener('click', async () => {
  // In a real implementation, this would open MetaMask or other wallet
  const address = prompt('Enter your wallet address:');

  if (address) {
    chrome.runtime.sendMessage({
      type: 'setWallet',
      address: address,
    }, (response) => {
      if (response.success) {
        state.walletAddress = address;
        updateUI();
      }
    });
  }
});

// Toggle active/inactive
document.getElementById('activeToggle').addEventListener('change', (e) => {
  chrome.runtime.sendMessage({
    type: 'toggleActive',
  }, (response) => {
    if (response.success) {
      state.isActive = response.isActive;
      updateUI();
    }
  });
});

// View dashboard
document.getElementById('viewDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
});

// Refresh state every 5 seconds
setInterval(init, 5000);

// Initialize on load
init();
