import { ethers } from "hardhat";

async function main() {
  console.log("Checking deployer wallet balance...");
  
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  
  const balance = await provider.getBalance(wallet.address);
  const balanceInMatic = ethers.formatEther(balance);
  
  // Get MATIC price
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd");
  const data = await response.json();
  const maticPrice = data["matic-network"].usd;
  
  console.log("\nWallet Details:");
  console.log("---------------");
  console.log(`Address: ${wallet.address}`);
  console.log(`Balance: ${balanceInMatic} MATIC`);
  console.log(`Balance in USD: $${(Number(balanceInMatic) * maticPrice).toFixed(2)}`);
  
  // Check if balance is sufficient for deployment
  const minRequired = 2; // 2 MATIC for safe deployment
  if (Number(balanceInMatic) < minRequired) {
    console.log(`\n⚠️ Warning: Balance too low for safe deployment. Need at least ${minRequired} MATIC`);
  } else {
    console.log("\n✅ Balance is sufficient for deployment");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 