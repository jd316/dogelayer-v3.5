import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { WDOGE, WDOGEStaking } from "../../typechain-types";

describe("WDOGEStaking", function() {
  let wdoge: WDOGE;
  let staking: WDOGEStaking;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let other: SignerWithAddress;
  let bridge: SignerWithAddress;

  const initialStake = ethers.parseEther("1000");
  const defaultRewardRate = 100; // 1% annual reward rate

  beforeEach(async () => {
    [owner, user, other, bridge] = await ethers.getSigners();

    // Deploy WDOGE token
    const WDOGEFactory = await ethers.getContractFactory("WDOGE");
    wdoge = await WDOGEFactory.deploy() as WDOGE;
    await wdoge.waitForDeployment();

    // Deploy Staking contract
    const StakingFactory = await ethers.getContractFactory("WDOGEStaking");
    staking = await StakingFactory.deploy(await wdoge.getAddress()) as WDOGEStaking;
    await staking.waitForDeployment();

    // Set bridge
    await wdoge.setBridge(bridge.address);
  });

  describe("Unstaking", () => {
    const stakeAmount = ethers.parseEther("100");
    
    beforeEach(async () => {
      // Mint tokens to user and staking contract for rewards
      await wdoge.connect(bridge).mint(user.address, stakeAmount);
      await wdoge.connect(bridge).mint(await staking.getAddress(), stakeAmount); // For rewards
      await wdoge.connect(user).approve(await staking.getAddress(), stakeAmount);
      
      // Stake tokens
      await staking.connect(user).stake(stakeAmount);
    });

    it("should allow users to unstake tokens", async () => {
      await expect(staking.connect(user).unstake(stakeAmount))
        .to.emit(staking, "Unstaked")
        .withArgs(user.address, stakeAmount);

      const stake = await staking.stakes(user.address);
      expect(stake.amount).to.equal(0n);
    });

    it("should reject zero unstake amount", async () => {
      await expect(staking.connect(user).unstake(0))
        .to.be.revertedWith("Cannot unstake 0");
    });

    it("should reject unstaking more than staked", async () => {
      const tooMuch = stakeAmount + ethers.parseEther("1");
      await expect(staking.connect(user).unstake(tooMuch))
        .to.be.revertedWith("Insufficient stake");
    });

    it("should claim rewards when unstaking", async () => {
      // Wait some time for rewards to accrue
      const startBlock = await ethers.provider.getBlock('latest');
      if (!startBlock) throw new Error("Failed to get block");
      const startTime = startBlock.timestamp;

      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 1 week
      await ethers.provider.send("evm_mine", []);

      const endBlock = await ethers.provider.getBlock('latest');
      if (!endBlock) throw new Error("Failed to get block");
      const endTime = endBlock.timestamp;

      // Calculate expected rewards using the exact same formula as the contract
      const timeElapsed = BigInt(endTime - startTime);
      const rewardRate = await staking.rewardRate();
      const expectedReward = (stakeAmount * rewardRate * timeElapsed) / (BigInt(365 * 24 * 60 * 60) * BigInt(10000));

      // Calculate acceptable range (±0.1% to account for rounding)
      const minReward = expectedReward * BigInt(999) / BigInt(1000);
      const maxReward = expectedReward * BigInt(1001) / BigInt(1000);

      // Unstake and verify rewards
      const tx = await staking.connect(user).unstake(stakeAmount);
      const receipt = await tx.wait();
      
      // Find RewardClaimed event
      const event = receipt?.logs.find(log => {
        try {
          const decoded = staking.interface.parseLog({ topics: log.topics as string[], data: log.data });
          return decoded?.name === "RewardClaimed";
        } catch {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;
      const decoded = staking.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const actualReward = decoded?.args[1];
      
      expect(actualReward).to.be.at.least(minReward);
      expect(actualReward).to.be.at.most(maxReward);

      const finalStake = await staking.stakes(user.address);
      expect(finalStake.amount).to.equal(0n);
      expect(finalStake.rewardDebt).to.equal(0n);
    });
  });
}); 