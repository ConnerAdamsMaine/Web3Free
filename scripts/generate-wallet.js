const hre = require("hardhat");

/**
 * Generate a new Ethereum wallet for backend API use
 *
 * SECURITY WARNING:
 * - Store the private key securely (use environment variables, never commit to git)
 * - Use a hardware wallet or key management service in production
 * - Fund this wallet with enough ETH for gas fees
 */
async function main() {
  console.log("Generating new Ethereum wallet for backend API...\n");

  // Generate a random wallet
  const wallet = hre.ethers.Wallet.createRandom();

  console.log("=".repeat(60));
  console.log("NEW WALLET GENERATED");
  console.log("=".repeat(60));
  console.log(`Address:     ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`Mnemonic:    ${wallet.mnemonic.phrase}`);
  console.log("=".repeat(60));

  console.log("\n⚠️  SECURITY WARNINGS:");
  console.log("1. NEVER commit the private key or mnemonic to version control");
  console.log("2. Store the private key in backend/.env file");
  console.log("3. Use a hardware wallet or KMS in production");
  console.log("4. Fund this wallet with ETH for gas fees");
  console.log("5. Authorize this address as a verifier using authorize-verifier.js");

  console.log("\n📝 Add to backend/.env:");
  console.log(`VERIFIER_PRIVATE_KEY=${wallet.privateKey}`);

  console.log("\n📝 To authorize as verifier, run:");
  console.log(`VERIFIER_ADDRESS=${wallet.address} npx hardhat run scripts/authorize-verifier.js --network <network>`);

  console.log("\n💰 Fund this wallet:");
  console.log(`Send ETH to: ${wallet.address}`);
  console.log("Recommended: 0.1 ETH for testnet, more for mainnet");

  console.log("\n✅ Wallet generation complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
