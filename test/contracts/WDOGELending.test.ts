import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { WDOGE, WDOGELending } from "../../typechain-types";

describe("WDOGELending", function() {
  let wdoge: WDOGE;
  let lending: WDOGELending;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let liquidator: SignerWithAddress;
  let bridge: SignerWithAddress;

  beforeEach(async () => {
    [owner, user, liquidator, bridge] = await ethers.getSigners();
    
    const WDOGEFactory = await ethers.getContractFactory("WDOGE");
    wdoge = await WDOGEFactory.deploy() as WDOGE;
    await wdoge.waitForDeployment();
    
    const WDOGELendingFactory = await ethers.getContractFactory("WDOGELending");
    lending = await WDOGELendingFactory.deploy(await wdoge.getAddress()) as WDOGELending;
    await lending.waitForDeployment();
    
    await wdoge.setBridge(bridge.address);
  });

  it("should allow liquidation when below threshold", async () => {
    const borrowAmount = ethers.parseEther("100");
    const collateralAmount = ethers.parseEther("150");
    
    // First mint tokens to the user and lending contract
    await wdoge.connect(bridge).mint(user.address, collateralAmount);
    await wdoge.connect(bridge).mint(await lending.getAddress(), borrowAmount); // Add tokens for loan
    await wdoge.connect(user).approve(await lending.getAddress(), collateralAmount);
    
    // Create the loan
    await lending.connect(user).borrow(borrowAmount, collateralAmount);
    
    // Wait some time for interest to accrue and make ratio drop below threshold
    await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]); // 3 years
    await ethers.provider.send("evm_mine", []);
    
    // Get collateral ratio - should be below threshold due to accrued interest
    const ratio = await lending.getCollateralRatio(user.address);
    expect(ratio).to.be.at.most(130); // Should be at or below threshold
    
    // Liquidate the loan
    await expect(lending.connect(liquidator).liquidate(user.address))
      .to.emit(lending, "LoanLiquidated")
      .withArgs(user.address, liquidator.address, await lending.getTotalDue(user.address));
  });
}); 