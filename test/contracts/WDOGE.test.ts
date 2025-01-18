import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { WDOGE } from "../../typechain-types";

describe("WDOGE", function() {
  let wdoge: WDOGE;
  let owner: HardhatEthersSigner;
  let bridge: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;

  async function deployFixture() {
    [owner, bridge, user, recipient] = await ethers.getSigners();
    const WDOGEFactory = await ethers.getContractFactory("WDOGE");
    wdoge = await WDOGEFactory.deploy() as WDOGE;
    await wdoge.waitForDeployment();
    return { wdoge, owner, bridge, user, recipient };
  }

  beforeEach(async function() {
    const fixture = await loadFixture(deployFixture);
    wdoge = fixture.wdoge;
    owner = fixture.owner;
    bridge = fixture.bridge;
    user = fixture.user;
    recipient = fixture.recipient;
  });

  describe("Deployment", () => {
    it("should set the correct name and symbol", async () => {
      expect(await wdoge.name()).to.equal("Wrapped Dogecoin");
      expect(await wdoge.symbol()).to.equal("wDOGE");
    });

    it("should set the correct decimals", async () => {
      expect(await wdoge.decimals()).to.equal(8);
    });

    it("should set the owner as bridge initially", async () => {
      expect(await wdoge.bridge()).to.equal(owner.address);
    });
  });

  describe("Bridge Management", () => {
    it("should allow owner to set bridge address", async () => {
      await wdoge.setBridge(bridge.address);
      expect(await wdoge.bridge()).to.equal(bridge.address);
    });

    it("should reject bridge address update from non-owner", async () => {
      await expect(
        wdoge.connect(user).setBridge(bridge.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reject invalid bridge address", async () => {
      await expect(
        wdoge.setBridge(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid bridge address");
    });
  });

  describe("Minting", () => {
    const mintAmount = ethers.parseEther("100");

    beforeEach(async () => {
      await wdoge.setBridge(bridge.address);
    });

    it("should allow bridge to mint tokens", async () => {
      await wdoge.connect(bridge).mint(user.address, mintAmount);
      expect(await wdoge.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("should reject minting from non-bridge address", async () => {
      await expect(
        wdoge.connect(user).mint(user.address, mintAmount)
      ).to.be.revertedWith("Only bridge can mint");
    });

    it("should emit Transfer event on mint", async () => {
      await expect(wdoge.connect(bridge).mint(user.address, mintAmount))
        .to.emit(wdoge, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, mintAmount);
    });
  });

  describe("Burning", () => {
    const burnAmount = ethers.parseEther("100");

    beforeEach(async () => {
      await wdoge.setBridge(bridge.address);
      await wdoge.connect(bridge).mint(user.address, burnAmount);
    });

    it("should allow bridge to burn tokens", async () => {
      await wdoge.connect(bridge).burn(user.address, burnAmount);
      expect(await wdoge.balanceOf(user.address)).to.equal(0);
    });

    it("should reject burning from non-bridge address", async () => {
      await expect(
        wdoge.connect(user).burn(user.address, burnAmount)
      ).to.be.revertedWith("Only bridge can burn");
    });

    it("should emit Transfer event on burn", async () => {
      await expect(wdoge.connect(bridge).burn(user.address, burnAmount))
        .to.emit(wdoge, "Transfer")
        .withArgs(user.address, ethers.ZeroAddress, burnAmount);
    });
  });

  describe("Transfers", () => {
    const transferAmount = ethers.parseEther("100");

    beforeEach(async () => {
      await wdoge.setBridge(bridge.address);
      await wdoge.connect(bridge).mint(user.address, transferAmount);
    });

    it("should allow normal transfers", async () => {
      await wdoge.connect(user).transfer(recipient.address, transferAmount);
      expect(await wdoge.balanceOf(recipient.address)).to.equal(transferAmount);
      expect(await wdoge.balanceOf(user.address)).to.equal(0);
    });

    it("should reject transfers when paused", async () => {
      await wdoge.connect(owner).pause();
      await expect(
        wdoge.connect(user).transfer(recipient.address, transferAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should allow transfers after unpause", async () => {
      await wdoge.connect(owner).pause();
      await wdoge.connect(owner).unpause();
      await wdoge.connect(user).transfer(recipient.address, transferAmount);
      expect(await wdoge.balanceOf(recipient.address)).to.equal(transferAmount);
    });
  });

  describe("Emergency Functions", () => {
    it("should allow owner to pause and unpause", async () => {
      await wdoge.connect(owner).pause();
      expect(await wdoge.paused()).to.be.true;

      await wdoge.connect(owner).unpause();
      expect(await wdoge.paused()).to.be.false;
    });

    it("should reject pause/unpause from non-owner", async () => {
      await expect(
        wdoge.connect(user).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await wdoge.connect(owner).pause();
      await expect(
        wdoge.connect(user).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow emergency withdrawal when paused", async () => {
      const amount = ethers.parseEther("100");
      await wdoge.setBridge(bridge.address);
      await wdoge.connect(bridge).mint(user.address, amount);
      await wdoge.connect(owner).pause();

      await expect(
        wdoge.connect(user).emergencyWithdraw()
      ).to.emit(wdoge, "EmergencyWithdrawn")
        .withArgs(user.address, amount);
    });

    it("should reject emergency withdrawal when not paused", async () => {
      await expect(
        wdoge.connect(user).emergencyWithdraw()
      ).to.be.revertedWith("Pausable: not paused");
    });
  });
}); 