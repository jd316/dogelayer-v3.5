import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DogecoinP2PKH } from "../../src/services/dogecoin/scripts/p2pkh";
import { WDOGE } from "../../typechain-types/contracts/WDOGE";
import { DogeBridge } from "../../typechain-types/contracts/DogeBridge";
import { WDOGEStaking } from "../../typechain-types/contracts/WDOGEStaking";
import { randomBytes } from "crypto";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Complete Flow Integration Test", function () {
    let wdoge: WDOGE;
    let bridge: DogeBridge;
    let staking: WDOGEStaking;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let operator: SignerWithAddress;
    let dogecoinPrivateKey: string;
    let dogecoinAddress: string;
    let dogecoin: DogecoinP2PKH;

    const depositAmount = ethers.parseUnits("100", 8); // 100 DOGE with 8 decimals
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SIGNER_ROLE"));

    beforeEach(async function () {
        // Get signers
        [owner, user, operator] = await ethers.getSigners();

        // Deploy WDOGE
        const WDOGEFactory = await ethers.getContractFactory("WDOGE");
        wdoge = await WDOGEFactory.deploy() as WDOGE;
        await wdoge.waitForDeployment();

        // Deploy Bridge
        const BridgeFactory = await ethers.getContractFactory("DogeBridge");
        bridge = await BridgeFactory.deploy(
            await wdoge.getAddress(),
            ethers.parseUnits("1", 8),     // minDeposit: 1 DOGE
            ethers.parseUnits("1000", 8),  // maxDeposit: 1000 DOGE
            ethers.parseUnits("0.1", 8)    // bridgeFee: 0.1 DOGE
        ) as DogeBridge;
        await bridge.waitForDeployment();

        // Deploy Staking
        const StakingFactory = await ethers.getContractFactory("WDOGEStaking");
        staking = await StakingFactory.deploy(await wdoge.getAddress()) as WDOGEStaking;
        await staking.waitForDeployment();

        // Set bridge in WDOGE contract
        await wdoge.setBridge(await bridge.getAddress());

        // Grant roles to operator
        await bridge.grantRole(OPERATOR_ROLE, operator.address);
        await bridge.grantRole(SIGNER_ROLE, operator.address);

        // Generate Dogecoin address
        dogecoinPrivateKey = randomBytes(32).toString('hex');
        dogecoin = new DogecoinP2PKH(dogecoinPrivateKey);
        dogecoinAddress = dogecoin.generateAddress();
    });

    async function processDeposit(amount: bigint, userAddress: string) {
        const depositId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "string"],
                [userAddress, amount, dogecoinAddress]
            )
        );

        const messageHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "bytes32"],
                [userAddress, amount, depositId]
            )
        );
        const signature = await operator.signMessage(ethers.getBytes(messageHash));

        await bridge.connect(operator).processDeposit(
            userAddress,
            amount,
            depositId,
            signature
        );

        return depositId;
    }

    describe("Deposit and Stake Flow", function() {
        it("should complete full flow: P2PKH > Deposit > wDOGE > Stake", async function () {
            // 1. Verify P2PKH address generation
            expect(dogecoinAddress).to.match(/^D[1-9A-HJ-NP-Za-km-z]{33}$/);
            console.log("\nGenerated Dogecoin address:", dogecoinAddress);

            // 2. Process deposit and mint wDOGE
            await processDeposit(depositAmount, user.address);

            // Verify wDOGE balance
            const wdogeBalance = await wdoge.balanceOf(user.address);
            expect(wdogeBalance).to.equal(depositAmount);
            console.log("wDOGE balance after deposit:", ethers.formatEther(wdogeBalance));

            // 3. Approve and stake wDOGE
            await wdoge.connect(user).approve(await staking.getAddress(), depositAmount);
            await staking.connect(user).stake(depositAmount);

            // Verify staking
            const stakeInfo = await staking.getStakeInfo(user.address);
            expect(stakeInfo.stakedAmount).to.equal(depositAmount);
            console.log("Initial staked amount:", ethers.formatEther(stakeInfo.stakedAmount));
            console.log("Initial pending rewards:", ethers.formatEther(stakeInfo.pendingRewards));
        });

        it("should accumulate rewards over time", async function() {
            // Initial deposit and stake
            await processDeposit(depositAmount, user.address);
            await wdoge.connect(user).approve(await staking.getAddress(), depositAmount);
            await staking.connect(user).stake(depositAmount);

            // Advance time by 30 days
            await time.increase(30 * 24 * 60 * 60);

            // Check rewards
            const stakeInfo = await staking.getStakeInfo(user.address);
            expect(stakeInfo.pendingRewards).to.be.gt(0);
            console.log("\nRewards after 30 days:", ethers.formatEther(stakeInfo.pendingRewards));
        });
    });

    describe("Withdrawal Flow", function() {
        it("should return DOGE to user after withdrawal", async function() {
            // First deposit for staking (100 DOGE)
            const depositAmount = ethers.parseUnits("100", 8);
            const stakingAddress = await staking.getAddress();
            const depositId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "uint256"],
                [user.address, depositAmount, 0]
            ));
            const messageHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "bytes32"],
                [user.address, depositAmount, depositId]
            ));
            const messageHashBytes = ethers.getBytes(messageHash);
            const signature = await operator.signMessage(messageHashBytes);

            await bridge.processDeposit(user.address, depositAmount, depositId, signature);

            // Second deposit for rewards (10 DOGE)
            const rewardAmount = ethers.parseUnits("10", 8);
            const rewardDepositId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "uint256"],
                [stakingAddress, rewardAmount, 1]
            ));
            const rewardMessageHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "bytes32"],
                [stakingAddress, rewardAmount, rewardDepositId]
            ));
            const rewardMessageHashBytes = ethers.getBytes(rewardMessageHash);
            const rewardSignature = await operator.signMessage(rewardMessageHashBytes);

            await bridge.processDeposit(stakingAddress, rewardAmount, rewardDepositId, rewardSignature);

            // Approve and stake WDOGE
            await wdoge.connect(user).approve(stakingAddress, depositAmount);
            await staking.connect(user).stake(depositAmount);

            // Wait for 30 days to accumulate rewards
            await time.increase(30 * 24 * 60 * 60);

            // Get total amount (staked + rewards)
            const userStake = await staking.stakes(user.address);
            const totalAmount = userStake.amount + userStake.rewardDebt;

            // Unstake everything
            await staking.connect(user).unstake(totalAmount);

            // Request withdrawal
            const dogeAddress = "DBXu2kgc3xtvCUWFcxFE3r9hEYgmuaaCyD"; // Example Dogecoin address
            console.log("Generated Dogecoin address:", dogeAddress);
            const bridgeAddress = await bridge.getAddress();
            await wdoge.connect(user).approve(bridgeAddress, totalAmount);
            await bridge.connect(user).requestWithdrawal(dogeAddress, totalAmount);

            // Verify withdrawal event was emitted with correct details
            const withdrawalFilter = bridge.filters.Withdrawal;
            const events = await bridge.queryFilter(withdrawalFilter);
            expect(events.length).to.be.greaterThan(0);
            const withdrawalEvent = events[events.length - 1];
            expect(withdrawalEvent.args.sender).to.equal(user.address);
            expect(withdrawalEvent.args.dogeAddress).to.equal(dogeAddress);
            expect(withdrawalEvent.args.amount).to.equal(totalAmount - await bridge.bridgeFee());
        });
    });

    describe("Error Cases", function() {
        it("should reject deposits below minimum", async function() {
            const smallAmount = ethers.parseUnits("0.5", 8); // 0.5 DOGE
            await expect(
                processDeposit(smallAmount, user.address)
            ).to.be.revertedWith("Invalid amount");
        });

        it("should reject deposits above maximum", async function() {
            const largeAmount = ethers.parseUnits("2000", 8); // 2000 DOGE
            await expect(
                processDeposit(largeAmount, user.address)
            ).to.be.revertedWith("Invalid amount");
        });

        it("should reject invalid signatures", async function() {
            const depositId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "string"],
                    [user.address, depositAmount, dogecoinAddress]
                )
            );

            // Use wrong signer
            const wrongSigner = user; // user is not an operator
            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "bytes32"],
                    [user.address, depositAmount, depositId]
                )
            );
            const invalidSignature = await wrongSigner.signMessage(ethers.getBytes(messageHash));

            await expect(
                bridge.connect(operator).processDeposit(
                    user.address,
                    depositAmount,
                    depositId,
                    invalidSignature
                )
            ).to.be.revertedWith("Invalid signature");
        });

        it("should reject staking without approval", async function() {
            await processDeposit(depositAmount, user.address);
            await expect(
                staking.connect(user).stake(depositAmount)
            ).to.be.reverted;
        });

        it("should reject withdrawal without unstaking first", async function() {
            await processDeposit(depositAmount, user.address);
            await wdoge.connect(user).approve(await staking.getAddress(), depositAmount);
            await staking.connect(user).stake(depositAmount);

            // Try to withdraw while still staked
            await expect(
                bridge.connect(user).requestWithdrawal(dogecoinAddress, depositAmount)
            ).to.be.reverted;
        });
    });
}); 