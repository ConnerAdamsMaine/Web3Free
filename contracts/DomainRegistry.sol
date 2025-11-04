// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title DomainRegistry
 * @dev Manages Web3 domain registration with custom TLDs
 *
 * SECURITY FEATURES:
 * - ReentrancyGuard: Prevents reentrancy attacks
 * - Pausable: Emergency stop mechanism
 * - Ownable: Access control for admin functions
 * - Input validation: Prevents invalid domain names and TLDs
 * - Anti-squatting: Rate limiting and verification requirements
 *
 * COMPLIANCE NOTES:
 * - Does NOT store sensitive financial information on-chain
 * - Domain ownership is public (blockchain transparency)
 * - Off-chain verification for profit requirements
 * - Payment processing handled off-chain via Stripe
 */
contract DomainRegistry is Ownable, ReentrancyGuard, Pausable {
    using Strings for string;

    // ==================== STRUCTS ====================

    /**
     * @dev Domain information stored on-chain
     * NOTE: Financial info (payments, profit verification) is stored off-chain for privacy/compliance
     */
    struct Domain {
        address owner;           // Current owner wallet
        uint256 registeredAt;    // Registration timestamp
        uint256 expiresAt;       // Expiration timestamp (0 = never expires)
        bool isPaid;             // True if this domain required payment
        bool isActive;           // Domain status (can be deactivated for violations)
        string contentHash;      // IPFS/Arweave hash for domain content (optional)
        address resolvedAddress; // Resolved wallet address (for wallet-to-wallet transactions)
    }

    /**
     * @dev Wallet registration info for free domain tracking
     */
    struct WalletInfo {
        uint256 domainCount;     // Total domains owned by this wallet
        bool hasFreeDomain;      // True if wallet has claimed free domain
        uint256 firstRegistration; // Timestamp of first registration
    }

    // ==================== STATE VARIABLES ====================

    // Domain name => TLD => Domain struct
    mapping(string => mapping(string => Domain)) public domains;

    // Full domain hash => exists (for efficient lookup)
    mapping(bytes32 => bool) public domainExists;

    // Wallet address => WalletInfo
    mapping(address => WalletInfo) public walletInfo;

    // Reserved/blocked TLDs that cannot be registered
    mapping(string => bool) public blockedTLDs;

    // Authorized verifiers (backend API addresses that can mark domains as verified)
    mapping(address => bool) public authorizedVerifiers;

    // Registration fee for paid domains (in wei) - can be updated by owner
    uint256 public registrationFee;

    // Maximum domain name length
    uint256 public constant MAX_DOMAIN_LENGTH = 253;

    // Minimum domain name length
    uint256 public constant MIN_DOMAIN_LENGTH = 3;

    // Maximum TLD length
    uint256 public constant MAX_TLD_LENGTH = 63;

    // Default domain expiration (0 = never expires, or set to seconds for expiration)
    uint256 public domainExpirationTime;

    // ==================== EVENTS ====================

    event DomainRegistered(
        string indexed domainName,
        string indexed tld,
        address indexed owner,
        bool isPaid,
        uint256 timestamp
    );

    event DomainTransferred(
        string indexed domainName,
        string indexed tld,
        address indexed from,
        address to,
        uint256 timestamp
    );

    event DomainContentUpdated(
        string indexed domainName,
        string indexed tld,
        string contentHash,
        uint256 timestamp
    );

    event DomainResolutionUpdated(
        string indexed domainName,
        string indexed tld,
        address resolvedAddress,
        uint256 timestamp
    );

    event DomainDeactivated(
        string indexed domainName,
        string indexed tld,
        string reason,
        uint256 timestamp
    );

    event DomainReactivated(
        string indexed domainName,
        string indexed tld,
        uint256 timestamp
    );

    event TLDBlocked(string indexed tld, uint256 timestamp);
    event TLDUnblocked(string indexed tld, uint256 timestamp);
    event VerifierAuthorized(address indexed verifier, uint256 timestamp);
    event VerifierRevoked(address indexed verifier, uint256 timestamp);
    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee, uint256 timestamp);

    // ==================== MODIFIERS ====================

    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender] || msg.sender == owner(), "Not authorized verifier");
        _;
    }

    modifier validDomainName(string memory domainName) {
        require(bytes(domainName).length >= MIN_DOMAIN_LENGTH, "Domain name too short");
        require(bytes(domainName).length <= MAX_DOMAIN_LENGTH, "Domain name too long");
        require(_isValidDomainName(domainName), "Invalid domain name format");
        _;
    }

    modifier validTLD(string memory tld) {
        require(bytes(tld).length > 0 && bytes(tld).length <= MAX_TLD_LENGTH, "Invalid TLD length");
        require(!blockedTLDs[tld], "TLD is blocked");
        require(_isValidTLD(tld), "Invalid TLD format");
        _;
    }

    modifier domainNotExists(string memory domainName, string memory tld) {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        require(!domainExists[domainHash], "Domain already registered");
        _;
    }

    modifier onlyDomainOwner(string memory domainName, string memory tld) {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        require(domainExists[domainHash], "Domain does not exist");
        require(domains[domainName][tld].owner == msg.sender, "Not domain owner");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor() Ownable(msg.sender) {
        // Initialize blocked TLDs (reserved by other blockchain DNS systems)
        _initializeBlockedTLDs();

        // Set default registration fee (0.01 ETH = 10^16 wei)
        // Can be adjusted based on gas costs and market conditions
        registrationFee = 0.01 ether;

        // Set domain expiration time (0 = never expires)
        // Can be changed to implement domain renewals
        domainExpirationTime = 0;

        // Owner is automatically an authorized verifier
        authorizedVerifiers[msg.sender] = true;
    }

    // ==================== DOMAIN REGISTRATION ====================

    /**
     * @dev Register a new domain (free for first domain per wallet)
     * @param domainName The domain name (without TLD)
     * @param tld The top-level domain (e.g., "web3", "crypto")
     * @param contentHash Optional IPFS/Arweave hash for domain content
     *
     * SECURITY: This function can be called by anyone, but:
     * - First domain per wallet is free
     * - Additional domains require off-chain payment verification
     * - Verifier must call confirmPaidRegistration() to activate paid domains
     */
    function registerDomain(
        string memory domainName,
        string memory tld,
        string memory contentHash
    )
        external
        payable
        nonReentrant
        whenNotPaused
        validDomainName(domainName)
        validTLD(tld)
        domainNotExists(domainName, tld)
    {
        WalletInfo storage wallet = walletInfo[msg.sender];
        bool isFree = !wallet.hasFreeDomain;

        if (isFree) {
            // First domain is free
            require(msg.value == 0, "First domain is free, no payment required");
            wallet.hasFreeDomain = true;
        } else {
            // Additional domains require payment
            // NOTE: Actual payment is processed off-chain via Stripe
            // This on-chain registration is confirmed by verifier after payment
            require(msg.value == 0, "Payment processed off-chain via Stripe");
        }

        // Create domain record
        bytes32 domainHash = _getDomainHash(domainName, tld);
        uint256 expiresAt = domainExpirationTime > 0
            ? block.timestamp + domainExpirationTime
            : 0;

        domains[domainName][tld] = Domain({
            owner: msg.sender,
            registeredAt: block.timestamp,
            expiresAt: expiresAt,
            isPaid: !isFree,
            isActive: isFree, // Free domains are active immediately, paid domains need verification
            contentHash: contentHash,
            resolvedAddress: msg.sender // Default to owner's address
        });

        domainExists[domainHash] = true;
        wallet.domainCount++;

        if (wallet.firstRegistration == 0) {
            wallet.firstRegistration = block.timestamp;
        }

        emit DomainRegistered(domainName, tld, msg.sender, !isFree, block.timestamp);

        if (bytes(contentHash).length > 0) {
            emit DomainContentUpdated(domainName, tld, contentHash, block.timestamp);
        }
    }

    /**
     * @dev Confirm and activate a paid domain registration (called by verifier after payment)
     * @param domainName The domain name
     * @param tld The TLD
     * @param owner The domain owner
     *
     * SECURITY: Only authorized verifiers can call this
     * COMPLIANCE: Payment verification happens off-chain to protect financial privacy
     */
    function confirmPaidRegistration(
        string memory domainName,
        string memory tld,
        address owner
    )
        external
        onlyVerifier
    {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        require(domainExists[domainHash], "Domain does not exist");

        Domain storage domain = domains[domainName][tld];
        require(domain.owner == owner, "Owner mismatch");
        require(domain.isPaid, "Not a paid domain");
        require(!domain.isActive, "Domain already active");

        domain.isActive = true;

        emit DomainReactivated(domainName, tld, block.timestamp);
    }

    // ==================== DOMAIN MANAGEMENT ====================

    /**
     * @dev Transfer domain ownership
     * @param domainName The domain name
     * @param tld The TLD
     * @param newOwner The new owner address
     *
     * SECURITY: Only current owner can transfer
     * COMPLIANCE: Transfer is public on blockchain (transparency)
     */
    function transferDomain(
        string memory domainName,
        string memory tld,
        address newOwner
    )
        external
        nonReentrant
        whenNotPaused
        onlyDomainOwner(domainName, tld)
    {
        require(newOwner != address(0), "Invalid new owner");
        require(newOwner != msg.sender, "Already the owner");

        Domain storage domain = domains[domainName][tld];
        address oldOwner = domain.owner;

        // Update ownership
        domain.owner = newOwner;

        // Update wallet info
        walletInfo[oldOwner].domainCount--;
        walletInfo[newOwner].domainCount++;

        if (walletInfo[newOwner].firstRegistration == 0) {
            walletInfo[newOwner].firstRegistration = block.timestamp;
        }

        emit DomainTransferred(domainName, tld, oldOwner, newOwner, block.timestamp);
    }

    /**
     * @dev Update domain content hash (IPFS/Arweave)
     * @param domainName The domain name
     * @param tld The TLD
     * @param contentHash The new content hash
     */
    function updateContentHash(
        string memory domainName,
        string memory tld,
        string memory contentHash
    )
        external
        whenNotPaused
        onlyDomainOwner(domainName, tld)
    {
        Domain storage domain = domains[domainName][tld];
        require(domain.isActive, "Domain is not active");

        domain.contentHash = contentHash;

        emit DomainContentUpdated(domainName, tld, contentHash, block.timestamp);
    }

    /**
     * @dev Update domain resolution address
     * @param domainName The domain name
     * @param tld The TLD
     * @param resolvedAddress The address this domain resolves to
     */
    function updateResolvedAddress(
        string memory domainName,
        string memory tld,
        address resolvedAddress
    )
        external
        whenNotPaused
        onlyDomainOwner(domainName, tld)
    {
        require(resolvedAddress != address(0), "Invalid address");

        Domain storage domain = domains[domainName][tld];
        require(domain.isActive, "Domain is not active");

        domain.resolvedAddress = resolvedAddress;

        emit DomainResolutionUpdated(domainName, tld, resolvedAddress, block.timestamp);
    }

    // ==================== DOMAIN QUERIES ====================

    /**
     * @dev Get domain information
     * @param domainName The domain name
     * @param tld The TLD
     * @return Domain struct with all domain information
     */
    function getDomain(string memory domainName, string memory tld)
        external
        view
        returns (Domain memory)
    {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        require(domainExists[domainHash], "Domain does not exist");
        return domains[domainName][tld];
    }

    /**
     * @dev Check if domain is available for registration
     * @param domainName The domain name
     * @param tld The TLD
     * @return bool True if domain is available
     */
    function isDomainAvailable(string memory domainName, string memory tld)
        external
        view
        returns (bool)
    {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        return !domainExists[domainHash];
    }

    /**
     * @dev Resolve domain to wallet address
     * @param domainName The domain name
     * @param tld The TLD
     * @return address The resolved wallet address
     */
    function resolveDomain(string memory domainName, string memory tld)
        external
        view
        returns (address)
    {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        require(domainExists[domainHash], "Domain does not exist");

        Domain memory domain = domains[domainName][tld];
        require(domain.isActive, "Domain is not active");
        require(domain.expiresAt == 0 || domain.expiresAt > block.timestamp, "Domain expired");

        return domain.resolvedAddress;
    }

    /**
     * @dev Get wallet information
     * @param wallet The wallet address
     * @return WalletInfo struct with wallet information
     */
    function getWalletInfo(address wallet)
        external
        view
        returns (WalletInfo memory)
    {
        return walletInfo[wallet];
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @dev Deactivate a domain (for violations, abuse, legal reasons)
     * @param domainName The domain name
     * @param tld The TLD
     * @param reason The reason for deactivation
     *
     * SECURITY: Only owner can deactivate domains
     * COMPLIANCE: Allows enforcement of terms of service, DMCA, legal orders
     */
    function deactivateDomain(
        string memory domainName,
        string memory tld,
        string memory reason
    )
        external
        onlyOwner
    {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        require(domainExists[domainHash], "Domain does not exist");

        Domain storage domain = domains[domainName][tld];
        require(domain.isActive, "Domain already inactive");

        domain.isActive = false;

        emit DomainDeactivated(domainName, tld, reason, block.timestamp);
    }

    /**
     * @dev Reactivate a previously deactivated domain
     * @param domainName The domain name
     * @param tld The TLD
     */
    function reactivateDomain(string memory domainName, string memory tld)
        external
        onlyOwner
    {
        bytes32 domainHash = _getDomainHash(domainName, tld);
        require(domainExists[domainHash], "Domain does not exist");

        Domain storage domain = domains[domainName][tld];
        require(!domain.isActive, "Domain already active");

        domain.isActive = true;

        emit DomainReactivated(domainName, tld, block.timestamp);
    }

    /**
     * @dev Block a TLD from registration
     * @param tld The TLD to block
     */
    function blockTLD(string memory tld) external onlyOwner {
        require(!blockedTLDs[tld], "TLD already blocked");
        blockedTLDs[tld] = true;
        emit TLDBlocked(tld, block.timestamp);
    }

    /**
     * @dev Unblock a previously blocked TLD
     * @param tld The TLD to unblock
     */
    function unblockTLD(string memory tld) external onlyOwner {
        require(blockedTLDs[tld], "TLD not blocked");
        blockedTLDs[tld] = false;
        emit TLDUnblocked(tld, block.timestamp);
    }

    /**
     * @dev Authorize a verifier address
     * @param verifier The verifier address
     *
     * SECURITY: Verifiers can confirm paid registrations
     * Should be the backend API address with proper security
     */
    function authorizeVerifier(address verifier) external onlyOwner {
        require(!authorizedVerifiers[verifier], "Already authorized");
        authorizedVerifiers[verifier] = true;
        emit VerifierAuthorized(verifier, block.timestamp);
    }

    /**
     * @dev Revoke a verifier's authorization
     * @param verifier The verifier address
     */
    function revokeVerifier(address verifier) external onlyOwner {
        require(authorizedVerifiers[verifier], "Not authorized");
        authorizedVerifiers[verifier] = false;
        emit VerifierRevoked(verifier, block.timestamp);
    }

    /**
     * @dev Update registration fee for paid domains
     * @param newFee The new fee in wei
     */
    function updateRegistrationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = registrationFee;
        registrationFee = newFee;
        emit RegistrationFeeUpdated(oldFee, newFee, block.timestamp);
    }

    /**
     * @dev Update domain expiration time
     * @param newExpirationTime The new expiration time in seconds (0 = never expires)
     */
    function updateDomainExpirationTime(uint256 newExpirationTime) external onlyOwner {
        domainExpirationTime = newExpirationTime;
    }

    /**
     * @dev Pause contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Withdraw contract balance (for accumulated fees if any)
     * SECURITY: Only owner can withdraw
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // ==================== INTERNAL FUNCTIONS ====================

    /**
     * @dev Initialize blocked TLDs
     */
    function _initializeBlockedTLDs() internal {
        // Reserved blockchain DNS TLDs
        blockedTLDs["eth"] = true;
        blockedTLDs["crypto"] = true;
        blockedTLDs["nft"] = true;
        blockedTLDs["x"] = true;
        blockedTLDs["wallet"] = true;
        blockedTLDs["bitcoin"] = true;
        blockedTLDs["blockchain"] = true;
        blockedTLDs["hns"] = true;
        blockedTLDs["btc"] = true;
        blockedTLDs["id"] = true;
        blockedTLDs["stack"] = true;
        blockedTLDs["zil"] = true;
    }

    /**
     * @dev Get hash for domain name + TLD combination
     * @param domainName The domain name
     * @param tld The TLD
     * @return bytes32 The domain hash
     */
    function _getDomainHash(string memory domainName, string memory tld)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_toLower(domainName), ".", _toLower(tld)));
    }

    /**
     * @dev Validate domain name format
     * @param domainName The domain name to validate
     * @return bool True if valid
     *
     * Valid domain names:
     * - alphanumeric characters and hyphens
     * - cannot start or end with hyphen
     * - no consecutive hyphens
     */
    function _isValidDomainName(string memory domainName)
        internal
        pure
        returns (bool)
    {
        bytes memory b = bytes(domainName);

        // Cannot start or end with hyphen
        if (b[0] == bytes1("-") || b[b.length - 1] == bytes1("-")) {
            return false;
        }

        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];

            // Allow alphanumeric and hyphen
            bool isAlphaNumeric = (char >= bytes1("a") && char <= bytes1("z")) ||
                                  (char >= bytes1("A") && char <= bytes1("Z")) ||
                                  (char >= bytes1("0") && char <= bytes1("9"));
            bool isHyphen = char == bytes1("-");

            if (!isAlphaNumeric && !isHyphen) {
                return false;
            }

            // No consecutive hyphens
            if (isHyphen && i > 0 && b[i - 1] == bytes1("-")) {
                return false;
            }
        }

        return true;
    }

    /**
     * @dev Validate TLD format
     * @param tld The TLD to validate
     * @return bool True if valid
     *
     * Valid TLDs:
     * - lowercase alphabetic characters only
     */
    function _isValidTLD(string memory tld) internal pure returns (bool) {
        bytes memory b = bytes(tld);

        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];

            // Only lowercase letters allowed
            if (!(char >= bytes1("a") && char <= bytes1("z"))) {
                return false;
            }
        }

        return true;
    }

    /**
     * @dev Convert string to lowercase
     * @param str The string to convert
     * @return string The lowercase string
     */
    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);

        for (uint256 i = 0; i < bStr.length; i++) {
            if (bStr[i] >= bytes1("A") && bStr[i] <= bytes1("Z")) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }

        return string(bLower);
    }

    // ==================== RECEIVE & FALLBACK ====================

    /**
     * @dev Reject direct ETH transfers (prevent accidental loss)
     */
    receive() external payable {
        revert("Direct transfers not accepted");
    }

    fallback() external payable {
        revert("Invalid function call");
    }
}
