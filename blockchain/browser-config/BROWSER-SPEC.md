# Web3Browse Browser Specification

Complete specification for building the Web3Browse browser - a Chromium-based browser with built-in blockchain node.

## Overview

Web3Browse is a fork of Chromium that integrates:
- Full blockchain node
- Native domain resolution
- Built-in Web3 wallet
- Decentralized content loading
- Privacy-first browsing

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Web3Browse Browser                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │          Chromium Rendering Engine               │ │
│  │  (Blink, V8, Skia - Unchanged from Chromium)     │ │
│  └──────────────────────────────────────────────────┘ │
│                          │                             │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │         Web3Browse Custom Layer                  │ │
│  ├──────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │  ┌────────────────┐  ┌────────────────────────┐ │ │
│  │  │ Blockchain Node │  │  Domain Resolution     │ │ │
│  │  │ (Full Node)     │  │  (Custom DNS)          │ │ │
│  │  └────────────────┘  └────────────────────────┘ │ │
│  │                                                   │ │
│  │  ┌────────────────┐  ┌────────────────────────┐ │ │
│  │  │ Web3 Wallet     │  │  IPFS/Arweave Client   │ │ │
│  │  │ (Built-in)      │  │  (Content Loading)     │ │ │
│  │  └────────────────┘  └────────────────────────┘ │ │
│  │                                                   │ │
│  │  ┌────────────────┐  ┌────────────────────────┐ │ │
│  │  │ P2P Network     │  │  Privacy Tools         │ │ │
│  │  │ (libp2p)        │  │  (Ad-block, Tracking)  │ │ │
│  │  └────────────────┘  └────────────────────────┘ │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Building from Chromium

### 1. Prerequisites

```bash
# Ubuntu/Debian
sudo apt-get install git python3 lsb-release sudo

# Install depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$PATH:/path/to/depot_tools"
```

### 2. Get Chromium Source

```bash
mkdir ~/chromium && cd ~/chromium
fetch --nohooks chromium
cd src
git checkout -b web3browse

# Install dependencies
./build/install-build-deps.sh
gclient runhooks
```

### 3. Apply Web3Browse Modifications

Create these custom files in `chromium/src/`:

#### `web3browse/` Directory Structure

```
chromium/src/web3browse/
├── blockchain/           # Blockchain node (port from Node.js to C++)
├── domain_resolver/      # Custom DNS resolution
├── wallet/              # Web3 wallet implementation
├── ipfs/                # IPFS client
├── p2p/                 # P2P networking
└── ui/                  # Custom UI components
```

### 4. Modify Build Configuration

**`args.gn`:**

```gn
# Standard Chromium flags
is_debug = false
is_component_build = false
symbol_level = 0

# Web3Browse specific
enable_web3browse = true
enable_blockchain_node = true
enable_ipfs = true
enable_custom_dns = true

# Privacy features
enable_reporting = false
enable_google_services = false
safe_browsing_mode = 0

# Branding
chrome_pgo_phase = 0
is_official_build = true
```

### 5. Custom Components

#### A. Blockchain Node Integration

File: `web3browse/blockchain/blockchain_service.cc`

```cpp
#include "web3browse/blockchain/blockchain_service.h"
#include "content/public/browser/browser_thread.h"

namespace web3browse {

BlockchainService::BlockchainService() {
  // Initialize blockchain on IO thread
  content::BrowserThread::PostTask(
      content::BrowserThread::IO, FROM_HERE,
      base::BindOnce(&BlockchainService::InitializeBlockchain,
                     base::Unretained(this)));
}

void BlockchainService::InitializeBlockchain() {
  // Load chain from disk
  LoadChain();

  // Connect to P2P network
  ConnectToPeers();

  // Start block validation
  StartValidation();
}

}  // namespace web3browse
```

#### B. Custom Domain Resolution

File: `web3browse/domain_resolver/domain_resolver.cc`

```cpp
#include "web3browse/domain_resolver/domain_resolver.h"
#include "net/dns/host_resolver.h"

namespace web3browse {

bool DomainResolver::ResolveDomain(const std::string& domain,
                                   net::AddressList* addresses) {
  // Check if it's a Web3Browse domain
  if (IsWeb3BrowseDomain(domain)) {
    // Query blockchain for domain resolution
    auto domain_info = blockchain_service_->GetDomain(domain);

    if (domain_info.has_value()) {
      // Resolve to IPFS hash or IP address
      if (!domain_info->content_hash.empty()) {
        // Load from IPFS
        return ResolveIPFS(domain_info->content_hash, addresses);
      } else if (!domain_info->resolved_address.empty()) {
        // Direct IP resolution
        return ParseIPAddress(domain_info->resolved_address, addresses);
      }
    }

    return false;
  }

  // Fallback to standard DNS
  return standard_resolver_->Resolve(domain, addresses);
}

}  // namespace web3browse
```

#### C. Built-in Wallet

File: `web3browse/wallet/wallet_service.cc`

```cpp
#include "web3browse/wallet/wallet_service.h"
#include "crypto/signature_verifier.h"

namespace web3browse {

WalletService::WalletService() {
  // Load or generate wallet
  LoadWallet();
}

void WalletService::LoadWallet() {
  base::FilePath wallet_path = GetWalletPath();

  if (base::PathExists(wallet_path)) {
    // Load existing wallet
    std::string encrypted_key;
    base::ReadFileToString(wallet_path, &encrypted_key);
    DecryptPrivateKey(encrypted_key);
  } else {
    // Generate new wallet
    GenerateNewWallet();
  }
}

std::string WalletService::SignMessage(const std::string& message) {
  crypto::SignatureVerifier verifier;
  // Sign with private key
  return verifier.Sign(message, private_key_);
}

}  // namespace web3browse
```

### 6. UI Customizations

#### Custom New Tab Page

File: `chrome/browser/resources/web3browse_ntp/`

```javascript
// New Tab Page with blockchain stats
class Web3BrowseNTP {
  constructor() {
    this.blockchainService = chrome.web3browse.blockchain;
    this.walletService = chrome.web3browse.wallet;

    this.render();
    this.startUpdates();
  }

  render() {
    document.getElementById('wallet-address').textContent =
        this.walletService.getAddress();

    document.getElementById('w3b-balance').textContent =
        this.blockchainService.getBalance();

    document.getElementById('blocks-validated').textContent =
        this.blockchainService.getBlocksValidated();
  }

  startUpdates() {
    setInterval(() => this.render(), 5000);
  }
}

new Web3BrowseNTP();
```

#### Custom Settings Page

Add Web3Browse settings section:
- Blockchain node settings
- Wallet management
- Domain preferences
- Privacy controls

### 7. Build Process

```bash
# Generate build files
gn gen out/Web3Browse

# Build
autoninja -C out/Web3Browse chrome
```

### 8. Packaging

#### Windows

```bash
python3 chrome/installer/setup/build_installer.py \
  --output-dir=out/Web3Browse/installer \
  --product=Web3Browse
```

#### macOS

```bash
python3 chrome/installer/mac/build_installer.py \
  --output-dir=out/Web3Browse \
  --product=Web3Browse
```

#### Linux

```bash
# Debian package
python3 chrome/installer/linux/build_deb.py \
  --output-dir=out/Web3Browse \
  --product=Web3Browse

# Snap package
snapcraft
```

## Browser Features

### 1. Native Domain Resolution

- Automatically resolves `.web3`, `.crypto`, etc. from blockchain
- No need for DNS settings
- Instant resolution from local blockchain node
- Fallback to traditional DNS for standard domains

### 2. Built-in Blockchain Node

- Full node running in background
- Syncs on startup
- Low resource usage (optimized)
- Participates in consensus
- Earns rewards while browsing

### 3. Integrated Wallet

- One-click access from toolbar
- Sign transactions
- View balance and rewards
- Send/receive W3B tokens
- Connect to dApps

### 4. IPFS/Arweave Support

- Native loading of IPFS hashes
- Arweave content support
- Decentralized content caching
- P2P content delivery

### 5. Privacy Features

- Built-in ad blocker
- Tracker blocking
- No telemetry to Google
- Privacy-first defaults
- Optional Tor integration

### 6. Performance Optimizations

- Local blockchain = faster resolution
- P2P CDN for content
- Aggressive caching
- Resource prioritization

## Testing

### Unit Tests

```bash
# Run blockchain tests
out/Web3Browse/unit_tests --gtest_filter=Web3Browse*

# Run domain resolver tests
out/Web3Browse/unit_tests --gtest_filter=DomainResolver*
```

### Integration Tests

```bash
# Full browser tests
out/Web3Browse/browser_tests --gtest_filter=Web3Browse*
```

### Manual Testing

1. Install build
2. Navigate to a Web3Browse domain
3. Verify blockchain resolution
4. Check wallet functionality
5. Test transaction signing

## Distribution

### Auto-Update System

Use Chromium's update system:

```cpp
// Update endpoint
const char kUpdateURL[] = "https://update.web3browse.io/update";

// Check for updates daily
const base::TimeDelta kUpdateCheckInterval = base::Days(1);
```

### App Store Listings

- **Chrome Web Store**: Extension version
- **Microsoft Store**: Windows app
- **Mac App Store**: macOS app
- **Snap Store**: Linux app

## Maintenance

### Keeping Up with Chromium

```bash
# Sync with upstream Chromium
git fetch upstream
git rebase upstream/main

# Resolve conflicts in Web3Browse code
# Test thoroughly
```

### Security Updates

- Monitor Chromium security releases
- Apply patches within 24 hours
- Test and release quickly

## Development Roadmap

### Phase 1: MVP (3 months)
- Basic blockchain integration
- Domain resolution
- Simple wallet

### Phase 2: Full Features (6 months)
- Complete blockchain node
- IPFS integration
- Advanced wallet features

### Phase 3: Polish (9 months)
- Performance optimization
- UI refinement
- Mobile versions

### Phase 4: Ecosystem (12 months)
- Extension marketplace
- Developer tools
- dApp browser

## Resources

- Chromium source: https://chromium.googlesource.com/chromium/src
- Build instructions: https://chromium.org/developers/how-tos/get-the-code
- Chromium design docs: https://chromium.org/developers/design-documents

## License

Web3Browse browser code: MIT License
Chromium base: BSD License (see CHROMIUM_LICENSE)
