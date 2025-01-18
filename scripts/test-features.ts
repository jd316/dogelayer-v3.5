import { ethers } from "hardhat";
import { WDOGE, WDOGEStaking, WDOGELending } from "../typechain-types";

async function testStaking(wdoge: WDOGE, staking: WDOGEStaking, account: string) {
  console.log("\n--- Testing Staking ---");
  
  // Get initial balances
  const initialBalance = await wdoge.balanceOf(account);
  console.log("Initial WDOGE balance:", initialBalance);
  
  const stakeAmount = ethers.parseEther("50");
  
  // Approve staking contract
  console.log("Approving staking contract...");
  await wdoge.approve(await staking.getAddress(), stakeAmount);
  
  // Stake tokens
  console.log("Staking tokens...");
  await staking.stake(stakeAmount);
  
  // Check staked amount
  const [stakedAmount, pendingRewards] = await staking.getStakeInfo(account);
  console.log("Staked amount:", stakedAmount);
  console.log("Pending rewards:", pendingRewards);
  
  // Wait a bit to accumulate rewards
  console.log("Waiting for rewards to accumulate...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check rewards again
  const [_, newPendingRewards] = await staking.getStakeInfo(account);
  console.log("New pending rewards:", newPendingRewards);
  
  // Unstake half
  console.log("Unstaking half of tokens...");
  const halfAmount = stakeAmount / 2n;
  await staking.unstake(halfAmount);
  
  // Check final balance
  const finalBalance = await wdoge.balanceOf(account);
  console.log("Final WDOGE balance:", finalBalance);
}

async function testLending(wdoge: WDOGE, lending: WDOGELending, account: string) {
  console.log("\n--- Testing Lending ---");
  
  const collateralAmount = ethers.parseEther("150"); // 150% collateral ratio required
  const borrowAmount = ethers.parseEther("100");
  
  // Get initial balances
  const initialBalance = await wdoge.balanceOf(account);
  console.log("Initial WDOGE balance:", initialBalance);
  
  // Approve lending contract
  console.log("Approving lending contract...");
  await wdoge.approve(await lending.getAddress(), collateralAmount);
  
  // Borrow tokens
  console.log("Borrowing tokens...");
  await lending.borrow(borrowAmount, collateralAmount);
  
  // Check loan info
  const [loanAmount, collateral, interestDue, ratio] = await lending.getLoanInfo(account);
  console.log("Loan amount:", loanAmount);
  console.log("Collateral:", collateral);
  console.log("Interest due:", interestDue);
  console.log("Collateral ratio:", ratio);
  
  // Wait a bit for interest to accrue
  console.log("Waiting for interest to accrue...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check total due
  const totalDue = await lending.getTotalDue(account);
  console.log("Total amount due:", totalDue);
  
  // Repay loan
  console.log("Repaying loan...");
  await wdoge.approve(await lending.getAddress(), totalDue);
  await lending.repay(totalDue);
  
  // Check final balance
  const finalBalance = await wdoge.balanceOf(account);
  console.log("Final WDOGE balance:", finalBalance);
}

async function testErrorCases(wdoge: WDOGE, staking: WDOGEStaking, lending: WDOGELending, account: string) {
  console.log("\n--- Testing Error Cases ---");
  
  // Test staking errors
  console.log("Testing staking with 0 amount...");
  try {
    await staking.stake(0);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log("Expected error:", errorMessage);
  }
  
  // Test unstaking errors
  console.log("\nTesting unstaking more than staked...");
  try {
    await staking.unstake(ethers.parseEther("1000000"));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log("Expected error:", errorMessage);
  }
  
  // Test lending errors
  console.log("\nTesting borrowing with insufficient collateral...");
  try {
    await lending.borrow(ethers.parseEther("100"), ethers.parseEther("100"));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log("Expected error:", errorMessage);
  }
  
  // Test repayment errors
  console.log("\nTesting repaying non-existent loan...");
  try {
    await lending.repay(ethers.parseEther("100"));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log("Expected error:", errorMessage);
  }
}

async function testRateLimiting(wdoge: WDOGE, staking: WDOGEStaking, lending: WDOGELending, account: string) {
  console.log("\n--- Testing Rate Limiting ---");
  
  // Test rapid staking/unstaking
  console.log("Testing rapid staking/unstaking...");
  const amount = ethers.parseEther("10");
  
  for (let i = 0; i < 5; i++) {
    try {
      await wdoge.approve(await staking.getAddress(), amount);
      await staking.stake(amount);
      console.log(`Stake ${i + 1} successful`);
      await staking.unstake(amount);
      console.log(`Unstake ${i + 1} successful`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`Transaction ${i + 1} failed:`, errorMessage);
    }
    // Wait 1 second between iterations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test rapid borrowing/repaying
  console.log("\nTesting rapid borrowing/repaying...");
  const borrowAmount = ethers.parseEther("10");
  const collateralAmount = ethers.parseEther("15");
  
  for (let i = 0; i < 5; i++) {
    try {
      await wdoge.approve(await lending.getAddress(), collateralAmount);
      await lending.borrow(borrowAmount, collateralAmount);
      console.log(`Borrow ${i + 1} successful`);
      
      const totalDue = await lending.getTotalDue(account);
      await wdoge.approve(await lending.getAddress(), totalDue);
      await lending.repay(totalDue);
      console.log(`Repay ${i + 1} successful`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`Transaction ${i + 1} failed:`, errorMessage);
    }
    // Wait 1 second between iterations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Testing with account:", owner.address);
  
  // Get contract instances
  const wdoge = await ethers.getContractAt("WDOGE", "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707");
  const staking = await ethers.getContractAt("WDOGEStaking", "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6");
  const lending = await ethers.getContractAt("WDOGELending", "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318");
  
  // Mint some initial WDOGE for testing
  const bridge = await ethers.getContractAt("DogeBridge", "0x0165878A594ca255338adfa4d48449f69242Eb8F");
  
  // Grant OPERATOR_ROLE and SIGNER_ROLE to owner
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SIGNER_ROLE"));
  await bridge.grantRole(OPERATOR_ROLE, owner.address);
  await bridge.grantRole(SIGNER_ROLE, owner.address);
  
  // Create deposit parameters
  const depositAmount = ethers.parseEther("1000");
  const depositId = ethers.randomBytes(32);
  
  // Create and sign the message according to the contract's verification
  const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "bytes32"],
    [owner.address, depositAmount, depositId]
  );
  const messageHash = ethers.keccak256(encodedData);
  const signature = await owner.signMessage(ethers.getBytes(messageHash));
  
  // Process deposit
  await bridge.processDeposit(owner.address, depositAmount, depositId, signature);
  
  // Run tests
  await testStaking(wdoge, staking, owner.address);
  await testLending(wdoge, lending, owner.address);
  await testErrorCases(wdoge, staking, lending, owner.address);
  await testRateLimiting(wdoge, staking, lending, owner.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 