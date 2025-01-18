import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Get HRE if not in hardhat runtime environment
let hre: HardhatRuntimeEnvironment;
try {
  hre = require("hardhat");
} catch {
  console.log("Not in Hardhat Runtime Environment");
}

async function verifyContract(address: string, constructorArguments: any[] = []) {
  if (!process.env.POLYGONSCAN_API_KEY) {
    console.log("Skipping verification: No Polygonscan API key");
    return;
  }
  
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`✅ Contract verified: ${address}`);
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract already verified");
    } else {
      console.error("Error verifying contract:", error);
    }
  }
}

async function main() {
  // Initial setup and balance check
  const [deployer] = await ethers.getSigners();
  const initialBalance = await deployer.provider.getBalance(deployer.address);
  
  console.log("\nDeployment Configuration:");
  console.log("------------------------");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(initialBalance), "MATIC");

  // Existing WDOGE contract address
  const wdogeAddress = "0xbA4fd44f097BE15226f440a76F5237774E0068Aa";
  
  try {
    // 1. Deploy WDOGEStaking
    console.log("\nDeploying WDOGEStaking...");
    const stakingFactory = await ethers.getContractFactory("WDOGEStaking");
    const staking = await stakingFactory.deploy(wdogeAddress);
    await staking.waitForDeployment();
    const stakingAddress = (staking as unknown as { target: string }).target;
    console.log("✅ WDOGEStaking deployed to:", stakingAddress);

    // 2. Deploy WDOGELending
    console.log("\nDeploying WDOGELending...");
    const lendingFactory = await ethers.getContractFactory("WDOGELending");
    const lending = await lendingFactory.deploy(wdogeAddress);
    await lending.waitForDeployment();
    const lendingAddress = (lending as unknown as { target: string }).target;
    console.log("✅ WDOGELending deployed to:", lendingAddress);

    // 3. Deploy GasRelayer
    console.log("\nDeploying GasRelayer...");
    const gasRelayerFactory = await ethers.getContractFactory("GasRelayer");
    const gasRelayer = await gasRelayerFactory.deploy(wdogeAddress);
    await gasRelayer.waitForDeployment();
    const gasRelayerAddress = (gasRelayer as unknown as { target: string }).target;
    console.log("✅ GasRelayer deployed to:", gasRelayerAddress);

    // Verify contracts
    console.log("\nVerifying contracts on Polygonscan...");
    await verifyContract(stakingAddress, [wdogeAddress]);
    await verifyContract(lendingAddress, [wdogeAddress]);
    await verifyContract(gasRelayerAddress, [wdogeAddress]);

    // Calculate gas used
    const finalBalance = await deployer.provider.getBalance(deployer.address);
    const gasUsed = initialBalance - finalBalance;

    // Output deployment summary
    console.log("\nDeployment Summary:");
    console.log("-------------------");
    console.log("WDOGE (existing):", wdogeAddress);
    console.log("WDOGEStaking:", stakingAddress);
    console.log("WDOGELending:", lendingAddress);
    console.log("GasRelayer:", gasRelayerAddress);
    console.log("\nGas Used:", ethers.formatEther(gasUsed), "MATIC");
    
    // Save deployment addresses
    const deploymentInfo = {
      network: hre.network.name,
      chainId: hre.network.config.chainId,
      contracts: {
        WDOGE: wdogeAddress,
        WDOGEStaking: stakingAddress,
        WDOGELending: lendingAddress,
        GasRelayer: gasRelayerAddress
      },
      deploymentDate: new Date().toISOString()
    };

    const fs = require('fs');
    const deploymentPath = './deployments';
    if (!fs.existsSync(deploymentPath)) {
      fs.mkdirSync(deploymentPath);
    }
    
    fs.writeFileSync(
      `${deploymentPath}/${hre.network.name}.json`,
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`\n✅ Deployment information saved to ${deploymentPath}/${hre.network.name}.json`);
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 