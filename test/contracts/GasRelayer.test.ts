import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { WDOGE } from "../../typechain-types/contracts/WDOGE";
import { GasRelayer } from "../../typechain-types/contracts/GasRelayer";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("GasRelayer", function () {
  let gasRelayer: GasRelayer;
  let wdoge: WDOGE;
  let owner: SignerWithAddress;
  let relayer: SignerWithAddress;
  let oracle: SignerWithAddress;
  let user: SignerWithAddress;
  let RELAYER_ROLE: string;
  
  beforeEach(async function () {
    [owner, relayer, oracle, user] = await ethers.getSigners();
    
    // Deploy WDOGE first
    const WDOGEFactory = await ethers.getContractFactory("WDOGE");
    wdoge = (await WDOGEFactory.deploy()) as WDOGE;
    await wdoge.waitForDeployment();
    
    // Deploy GasRelayer
    const GasRelayerFactory = await ethers.getContractFactory("GasRelayer");
    gasRelayer = (await GasRelayerFactory.deploy(await wdoge.getAddress())) as GasRelayer;
    await gasRelayer.waitForDeployment();
    
    // Get and store RELAYER_ROLE
    RELAYER_ROLE = await gasRelayer.RELAYER_ROLE();
    
    // Grant roles
    await gasRelayer.grantRole(RELAYER_ROLE, relayer.address);
    await gasRelayer.grantRole(RELAYER_ROLE, oracle.address);
    
    // Mint some WDOGE to the GasRelayer for testing
    const gasRelayerAddress = await gasRelayer.getAddress();
    await wdoge.mint(gasRelayerAddress, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("should set the correct WDOGE address", async function () {
      expect(await gasRelayer.wdoge()).to.equal(await wdoge.getAddress());
    });
    
    it("should set initial gas price", async function () {
      expect(await gasRelayer.gasPrice()).to.be.gt(0);
    });
  });
  
  describe("Gas Price Updates", function () {
    it("should update gas price after interval", async function () {
      const initialGasPrice = await gasRelayer.gasPrice();
      
      // Increase time by more than UPDATE_INTERVAL
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);
      
      await gasRelayer.updateGasPrice();
      const newGasPrice = await gasRelayer.gasPrice();
      
      expect(newGasPrice).to.not.equal(initialGasPrice);
    });
    
    it("should reject updates before interval", async function () {
      await expect(gasRelayer.updateGasPrice())
        .to.be.revertedWith("Too soon to update");
    });
  });
  
  describe("Relayer Compensation", function () {
    it("should compensate relayer correctly", async function () {
      const gasUsed = 50000;
      const gasPrice = await gasRelayer.gasPrice();
      const multiplier = await gasRelayer.relayerFeeMultiplier();
      
      await gasRelayer.connect(relayer).compensateRelayer(relayer.address, gasUsed);
      
      const expectedCompensation = (gasPrice * BigInt(gasUsed) * multiplier) / BigInt(100);
      expect(await gasRelayer.relayerBalances(relayer.address)).to.equal(expectedCompensation);
    });
    
    it("should reject compensation from non-relayer", async function () {
      const expectedError = `AccessControl: account ${user.address.toLowerCase()} is missing role ${RELAYER_ROLE}`;
      await expect(gasRelayer.connect(user).compensateRelayer(user.address, 50000))
        .to.be.revertedWith(expectedError);
    });
  });

  describe("Balance Withdrawal", function () {
    it("should allow relayer to withdraw balance", async function () {
      const gasUsed = 50000;
      await gasRelayer.connect(relayer).compensateRelayer(relayer.address, gasUsed);
      
      const gasRelayerAddress = await gasRelayer.getAddress();
      await wdoge.mint(gasRelayerAddress, ethers.parseEther("1"));
      
      const initialBalance = await gasRelayer.relayerBalances(relayer.address);
      expect(initialBalance).to.be.gt(0);
      
      await gasRelayer.connect(relayer).withdrawRelayerBalance();
      
      expect(await gasRelayer.relayerBalances(relayer.address)).to.equal(0);
    });
    
    it("should reject withdrawal with no balance", async function () {
      await expect(gasRelayer.connect(user).withdrawRelayerBalance())
        .to.be.revertedWithCustomError(gasRelayer, "InsufficientBalance");
    });
  });
  
  describe("Fee Management", function () {
    it("should allow admin to update fee multiplier", async function () {
      const newMultiplier = 120; // 120%
      await gasRelayer.setRelayerFeeMultiplier(newMultiplier);
      expect(await gasRelayer.relayerFeeMultiplier()).to.equal(newMultiplier);
    });
    
    it("should reject invalid multipliers", async function () {
      await expect(gasRelayer.setRelayerFeeMultiplier(99))
        .to.be.revertedWith("Multiplier must be >= 100");
      
      await expect(gasRelayer.setRelayerFeeMultiplier(151))
        .to.be.revertedWith("Multiplier must be <= 150");
    });
  });
}); 