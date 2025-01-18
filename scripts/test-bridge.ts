import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Testing with account:", await owner.getAddress());

  // Get contract instances
  const bridge = await ethers.getContractAt("DogeBridge", "0x0165878A594ca255338adfa4d48449f69242Eb8F");
  const wdoge = await ethers.getContractAt("WDOGE", "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707");

  // Grant SIGNER_ROLE to owner
  const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SIGNER_ROLE"));
  await bridge.grantRole(SIGNER_ROLE, await owner.getAddress());
  console.log("Granted SIGNER_ROLE to owner");

  // Test deposit
  console.log("\nTesting deposit...");
  const depositAmount = ethers.parseEther("100");
  const timestamp = Math.floor(Date.now() / 1000);
  const depositId = ethers.keccak256(ethers.toUtf8Bytes(`test-deposit-${timestamp}`));
  
  // Create the message hash that matches the contract's verification
  const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "bytes32"],
    [await owner.getAddress(), depositAmount, depositId]
  );
  const messageHash = ethers.keccak256(encodedData);
  
  // Sign the Ethereum specific message
  const signature = await owner.signMessage(ethers.getBytes(messageHash));
  
  console.log("Initial WDOGE balance:", await wdoge.balanceOf(await owner.getAddress()));
  console.log("Processing deposit with signature:", signature);
  await bridge.processDeposit(await owner.getAddress(), depositAmount, depositId, signature);
  console.log("After deposit WDOGE balance:", await wdoge.balanceOf(await owner.getAddress()));

  // Test withdrawal
  console.log("\nTesting withdrawal...");
  const withdrawalAmount = ethers.parseEther("50");
  
  // Approve bridge to spend WDOGE
  console.log("Approving bridge to spend WDOGE...");
  await wdoge.approve(await bridge.getAddress(), withdrawalAmount);
  console.log("Bridge approved to spend WDOGE");
  
  console.log("Requesting withdrawal of", withdrawalAmount.toString(), "WDOGE");
  await bridge.requestWithdrawal("DRtUgZDkGXvyYvU3xNisYbxGJDzDwNqsEf", withdrawalAmount);
  console.log("After withdrawal request WDOGE balance:", await wdoge.balanceOf(await owner.getAddress()));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 