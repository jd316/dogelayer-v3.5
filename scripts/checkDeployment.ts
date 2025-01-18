import { ethers } from "hardhat";

async function main() {
  const addresses = {
    WDOGE: "0xbA4fd44f097BE15226f440a76F5237774E0068Aa",
    DogeBridge: "0xA4265ce16E2163Ee2218bBA2cfb6301693A7268B"
  };

  console.log("\nChecking contract deployments on Polygon...");
  console.log("----------------------------------------");

  try {
    // Check WDOGE
    console.log("\nChecking WDOGE...");
    const wdoge = await ethers.getContractAt("WDOGE", addresses.WDOGE);
    const wdogeName = await wdoge.name();
    const wdogeSymbol = await wdoge.symbol();
    const wdogeDecimals = await wdoge.decimals();
    console.log("✅ WDOGE is deployed and accessible");
    console.log("Name:", wdogeName);
    console.log("Symbol:", wdogeSymbol);
    console.log("Decimals:", wdogeDecimals);
    
    // Check Bridge
    console.log("\nChecking DogeBridge...");
    const bridge = await ethers.getContractAt("DogeBridge", addresses.DogeBridge);
    const wdogeInBridge = await bridge.wdoge();
    const minDeposit = await bridge.minDeposit();
    const maxDeposit = await bridge.maxDeposit();
    const bridgeFee = await bridge.bridgeFee();
    console.log("✅ DogeBridge is deployed and accessible");
    console.log("WDOGE Address in Bridge:", wdogeInBridge);
    console.log("Min Deposit:", ethers.formatEther(minDeposit), "DOGE");
    console.log("Max Deposit:", ethers.formatEther(maxDeposit), "DOGE");
    console.log("Bridge Fee:", ethers.formatEther(bridgeFee), "DOGE");

    // Check if bridge is set in WDOGE
    const bridgeInWDOGE = await wdoge.bridge();
    console.log("\nBridge address in WDOGE:", bridgeInWDOGE);
    console.log("Bridge properly set:", bridgeInWDOGE.toLowerCase() === addresses.DogeBridge.toLowerCase());

  } catch (error) {
    console.error("\n❌ Error checking deployments:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 