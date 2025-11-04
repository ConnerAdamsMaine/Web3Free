const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy DomainRegistry contract
 *
 * This script:
 * 1. Deploys the DomainRegistry contract
 * 2. Verifies the deployment
 * 3. Saves deployment information to a JSON file
 * 4. Optionally verifies on Etherscan
 */
async function main() {
  console.log("Starting deployment...\n");

  // Get network information
  const network = await hre.ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Check if deployer has enough balance
  if (balance === 0n) {
    throw new Error("Deployer account has no balance. Please fund the account.");
  }

  // Deploy DomainRegistry
  console.log("Deploying DomainRegistry contract...");
  const DomainRegistry = await hre.ethers.getContractFactory("DomainRegistry");

  // Estimate deployment gas
  const deployTransaction = await DomainRegistry.getDeployTransaction();
  const estimatedGas = await hre.ethers.provider.estimateGas(deployTransaction);
  console.log(`Estimated gas for deployment: ${estimatedGas.toString()}`);

  // Deploy the contract
  const domainRegistry = await DomainRegistry.deploy();
  await domainRegistry.waitForDeployment();

  const contractAddress = await domainRegistry.getAddress();
  console.log(`\n✅ DomainRegistry deployed to: ${contractAddress}`);

  // Get deployment transaction details
  const deploymentTx = domainRegistry.deploymentTransaction();
  if (deploymentTx) {
    console.log(`Deployment transaction hash: ${deploymentTx.hash}`);
    console.log(`Gas used: ${deploymentTx.gasLimit.toString()}`);
  }

  // Wait for a few block confirmations
  console.log("\nWaiting for block confirmations...");
  await domainRegistry.deploymentTransaction()?.wait(5);
  console.log("✅ Confirmed!");

  // Verify contract state
  console.log("\nVerifying contract state...");
  const registrationFee = await domainRegistry.registrationFee();
  const owner = await domainRegistry.owner();
  console.log(`Contract owner: ${owner}`);
  console.log(`Registration fee: ${hre.ethers.formatEther(registrationFee)} ETH`);

  // Check blocked TLDs
  const blockedTLDs = ["eth", "crypto", "nft", "wallet"];
  console.log("\nVerifying blocked TLDs...");
  for (const tld of blockedTLDs) {
    const isBlocked = await domainRegistry.blockedTLDs(tld);
    console.log(`  ${tld}: ${isBlocked ? "✅ Blocked" : "❌ Not blocked"}`);
  }

  // Save deployment information
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    deploymentTxHash: deploymentTx?.hash || "",
    blockNumber: deploymentTx?.blockNumber || 0,
    timestamp: new Date().toISOString(),
    registrationFee: hre.ethers.formatEther(registrationFee),
    owner: owner,
    abi: JSON.parse(domainRegistry.interface.formatJson()),
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to network-specific file
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n✅ Deployment info saved to: ${deploymentFile}`);

  // Save ABI to separate file for frontend
  const abiFile = path.join(deploymentsDir, "DomainRegistry.abi.json");
  fs.writeFileSync(abiFile, JSON.stringify(deploymentInfo.abi, null, 2));
  console.log(`✅ ABI saved to: ${abiFile}`);

  // Verification instructions
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network:           ${network.name}`);
  console.log(`Contract Address:  ${contractAddress}`);
  console.log(`Deployer:          ${deployer.address}`);
  console.log(`Registration Fee:  ${hre.ethers.formatEther(registrationFee)} ETH`);
  console.log("=".repeat(60));

  // Etherscan verification instructions
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n📝 To verify on Etherscan, run:");
    console.log(`npx hardhat verify --network ${network.name} ${contractAddress}`);
  }

  // Next steps
  console.log("\n📋 NEXT STEPS:");
  console.log("1. Update backend/.env with the contract address:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  console.log("2. Update frontend/.env with the contract address:");
  console.log(`   REACT_APP_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("3. Authorize the backend API address as a verifier:");
  console.log(`   npx hardhat run scripts/authorize-verifier.js --network ${network.name}`);
  console.log("4. Start the backend API server");
  console.log("5. Start the frontend application\n");

  return {
    contractAddress,
    deploymentInfo,
  };
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

module.exports = { main };
