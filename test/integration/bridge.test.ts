import { expect } from "chai";
import { ethers } from "hardhat";
import { BridgeService } from "../../src/services/bridgeService";
import { DogeBridge } from "../../typechain-types";
import { JsonRpcProvider } from "@ethersproject/providers";

describe("Bridge Integration Tests", function () {
  let bridgeService: BridgeService;
  let bridge: DogeBridge;
  let provider: JsonRpcProvider;

  before(async function () {
    // Setup code here
    provider = new JsonRpcProvider("http://localhost:8545");
    
    // Deploy contracts first
    const [owner] = await ethers.getSigners();
    
    // Deploy WDOGE
    const WDOGEFactory = await ethers.getContractFactory("WDOGE", owner);
    const wdoge = await WDOGEFactory.deploy();
    await wdoge.waitForDeployment();
    
    // Deploy DogeBridge
    const DogeBridgeFactory = await ethers.getContractFactory("DogeBridge", owner);
    bridge = await DogeBridgeFactory.deploy(
      await wdoge.getAddress(),
      BigInt("10000000"), // minDeposit: 0.01 DOGE
      BigInt("1000000000000"), // maxDeposit: 1000 DOGE
      BigInt("1000000") // bridgeFee: 0.001 DOGE
    ) as DogeBridge;
    await bridge.waitForDeployment();
    
    // Set bridge address in WDOGE
    await wdoge.setBridge(await bridge.getAddress());
    
    // Initialize BridgeService
    bridgeService = new BridgeService({
      providerUrl: "http://localhost:8545",
      bridgeAddress: await bridge.getAddress(),
      bridgeAbi: (await import("../../artifacts/contracts/DogeBridge.sol/DogeBridge.json")).abi,
      privateKey: "1234567890123456789012345678901234567890123456789012345678901234" // Test private key
    });
  });

  it("should initialize bridge service", async function () {
    expect(bridgeService).to.not.be.undefined;
  });
}); 