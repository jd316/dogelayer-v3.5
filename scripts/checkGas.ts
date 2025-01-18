import { ethers } from "hardhat";

async function main() {
  console.log("Checking current gas prices on Polygon...");
  
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  
  const gasPrice = await provider.getFeeData();
  
  console.log("\nCurrent Gas Prices:");
  console.log("-------------------");
  console.log(`Base Fee: ${ethers.formatUnits(gasPrice.gasPrice || 0, "gwei")} Gwei`);
  console.log(`Max Priority Fee: ${ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0, "gwei")} Gwei`);
  console.log(`Max Fee: ${ethers.formatUnits(gasPrice.maxFeePerGas || 0, "gwei")} Gwei`);
  
  // Get current MATIC price in USD
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd");
  const data = await response.json();
  const maticPrice = data["matic-network"].usd;
  
  console.log("\nEstimated Deployment Costs:");
  console.log("-------------------------");
  const totalGas = 10_000_000; // Estimated total gas for all contracts
  const gasCostMatic = Number(ethers.formatUnits(gasPrice.gasPrice || 0, "gwei")) * totalGas / 1e9;
  console.log(`Total Gas Units: ${totalGas.toLocaleString()}`);
  console.log(`Cost in MATIC: ${gasCostMatic.toFixed(4)} MATIC`);
  console.log(`Cost in USD: $${(gasCostMatic * maticPrice).toFixed(2)}`);
  
  if (Number(ethers.formatUnits(gasPrice.gasPrice || 0, "gwei")) > 100) {
    console.log("\n⚠️ Warning: Gas prices are currently high. Consider waiting for lower gas prices.");
  } else {
    console.log("\n✅ Gas prices are reasonable for deployment.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 