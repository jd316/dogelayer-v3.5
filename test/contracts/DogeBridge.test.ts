import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DogeBridge, WDOGE } from "../../typechain-types";

describe("DogeBridge", function () {
  let owner: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let signer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let bridge: DogeBridge;
  let wdoge: WDOGE;
  let testAmount: bigint;

  const minDeposit = BigInt("10000000"); // 0.01 DOGE in satoshis
  const maxDeposit = BigInt("1000000000000"); // 1000 DOGE in satoshis
  const bridgeFee = BigInt("1000000"); // 0.001 DOGE in satoshis
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SIGNER_ROLE"));
  const PREMIUM_USER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PREMIUM_USER_ROLE"));

  before(async function () {
    [owner, operator, signer, user] = await ethers.getSigners();
    
    // Deploy WDOGE first
    const WDOGEFactory = await ethers.getContractFactory("WDOGE", owner);
    wdoge = await WDOGEFactory.deploy() as WDOGE;
    await wdoge.waitForDeployment();
    
    // Deploy DogeBridge with WDOGE address
    const DogeBridgeFactory = await ethers.getContractFactory("DogeBridge", owner);
    bridge = await DogeBridgeFactory.deploy(
      await wdoge.getAddress(),
      minDeposit,
      maxDeposit,
      bridgeFee
    ) as DogeBridge;
    await bridge.waitForDeployment();
    
    // Set bridge address in WDOGE contract
    await wdoge.setBridge(await bridge.getAddress());
  });

  async function signDeposit(
    recipient: string,
    amount: bigint,
    depositId: string,
    signer: HardhatEthersSigner
  ): Promise<string> {
    const messageHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${recipient}${amount.toString()}${depositId}`)
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    return signature;
  }
}); 