import { ethers } from "hardhat";
import { Contract, BaseContract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { WDOGE, WDOGE__factory } from "../typechain-types";

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

async function deployContract(name: string, args: any[] = []): Promise<BaseContract> {
  console.log(`\nDeploying ${name}...`);
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = (contract as unknown as { target: string }).target;
  console.log(`✅ ${name} deployed to:`, address);
  return contract;
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
  
  try {
    // 1. Deploy WDOGE with proper typing
    const WDOGEFactory = await ethers.getContractFactory("WDOGE") as WDOGE__factory;
    const wdoge = await WDOGEFactory.deploy() as WDOGE;
    await wdoge.waitForDeployment();
    const wdogeAddress = (wdoge as unknown as { target: string }).target;
    console.log("✅ WDOGE deployed to:", wdogeAddress);

    // 2. Deploy Bridge with parameters
    const minDeposit = ethers.parseEther("1"); // 1 DOGE
    const maxDeposit = ethers.parseEther("1000000"); // 1M DOGE
    const bridgeFee = ethers.parseEther("1"); // 1 DOGE

    const bridge = await deployContract("DogeBridge", [
      wdogeAddress,
      minDeposit,
      maxDeposit,
      bridgeFee
    ]);
    const bridgeAddress = (bridge as unknown as { target: string }).target;

    // 3. Set bridge in WDOGE contract
    console.log("\nSetting bridge in WDOGE contract...");
    const setBridgeTx = await wdoge.setBridge(bridgeAddress);
    await setBridgeTx.wait();
    console.log("✅ Bridge set in WDOGE contract");

    // 4. Deploy Staking
    const staking = await deployContract("WDOGEStaking", [wdogeAddress]);
    const stakingAddress = (staking as unknown as { target: string }).target;

    // 5. Deploy Lending
    const lending = await deployContract("WDOGELending", [wdogeAddress]);
    const lendingAddress = (lending as unknown as { target: string }).target;

    // 6. Deploy GasRelayer
    const gasRelayer = await deployContract("GasRelayer", [wdogeAddress]);
    const gasRelayerAddress = (gasRelayer as unknown as { target: string }).target;

    // Verify all contracts
    console.log("\nVerifying contracts on Polygonscan...");
    await verifyContract(wdogeAddress);
    await verifyContract(bridgeAddress, [wdogeAddress, minDeposit, maxDeposit, bridgeFee]);
    await verifyContract(stakingAddress, [wdogeAddress]);
    await verifyContract(lendingAddress, [wdogeAddress]);
    await verifyContract(gasRelayerAddress, [wdogeAddress]);

    // Calculate gas used
    const finalBalance = await deployer.provider.getBalance(deployer.address);
    const gasUsed = initialBalance - finalBalance;

    // Output deployment summary
    console.log("\nDeployment Summary:");
    console.log("-------------------");
    console.log("WDOGE:", wdogeAddress);
    console.log("DogeBridge:", bridgeAddress);
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
        DogeBridge: bridgeAddress,
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