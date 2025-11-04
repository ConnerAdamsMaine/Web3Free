const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Authorize backend API address as a verifier
 *
 * This script authorizes the backend API's wallet address
 * to confirm paid domain registrations on-chain.
 *
 * SECURITY NOTE: Only authorize addresses you control and trust.
 */
async function main() {
  console.log("Authorizing verifier...\n");

  // Get network information
  const network = await hre.ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get deployer account (must be contract owner)
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer/Owner address: ${deployer.address}\n`);

  // Load deployment information
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  console.log(`Contract address: ${contractAddress}\n`);

  // Get contract instance
  const DomainRegistry = await hre.ethers.getContractAt("DomainRegistry", contractAddress);

  // Verify deployer is the owner
  const owner = await DomainRegistry.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not the contract owner. Owner: ${owner}`);
  }

  // Get verifier address from environment variable or prompt
  const verifierAddress = process.env.VERIFIER_ADDRESS;

  if (!verifierAddress) {
    console.error("❌ Error: VERIFIER_ADDRESS environment variable not set");
    console.log("\nUsage:");
    console.log("VERIFIER_ADDRESS=0x... npx hardhat run scripts/authorize-verifier.js --network <network>");
    console.log("\nThe verifier address should be the backend API's wallet address.");
    console.log("Generate one using: npx hardhat run scripts/generate-wallet.js");
    process.exit(1);
  }

  // Validate address
  if (!hre.ethers.isAddress(verifierAddress)) {
    throw new Error(`Invalid verifier address: ${verifierAddress}`);
  }

  console.log(`Verifier address to authorize: ${verifierAddress}`);

  // Check if already authorized
  const isAuthorized = await DomainRegistry.authorizedVerifiers(verifierAddress);

  if (isAuthorized) {
    console.log("✅ Address is already authorized as a verifier");
    return;
  }

  // Authorize the verifier
  console.log("\nAuthorizing verifier...");
  const tx = await DomainRegistry.authorizeVerifier(verifierAddress);
  console.log(`Transaction hash: ${tx.hash}`);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

  // Verify authorization
  const nowAuthorized = await DomainRegistry.authorizedVerifiers(verifierAddress);

  if (nowAuthorized) {
    console.log("\n✅ SUCCESS: Verifier authorized successfully!");
    console.log("\nUpdate your backend/.env file with:");
    console.log(`VERIFIER_PRIVATE_KEY=<private_key_for_${verifierAddress}>`);
  } else {
    console.log("\n❌ ERROR: Authorization failed. Please check the transaction.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:");
    console.error(error);
    process.exit(1);
  });
