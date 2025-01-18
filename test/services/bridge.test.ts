import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BridgeService } from '../../src/services/bridgeService';
import { AlertManager } from '../../src/services/alerting';
import DogeBridgeArtifact from '../../artifacts/contracts/DogeBridge.sol/DogeBridge.json';
import WDOGEArtifact from '../../artifacts/contracts/WDOGE.sol/WDOGE.json';

describe('Bridge Service Tests', () => {
    let bridgeService: BridgeService;
    let alertManager: AlertManager;
    let provider: ethers.JsonRpcProvider;
    
    beforeEach(async () => {
        provider = new ethers.JsonRpcProvider('http://localhost:8545');
        alertManager = new AlertManager({
            webhookUrl: 'http://localhost:9000/webhook'
        });
        
        // Deploy test contracts
        const [deployer] = await ethers.getSigners();
        
        // Deploy WDOGE
        const WDOGEFactory = await ethers.getContractFactory('WDOGE');
        const wdoge = await WDOGEFactory.deploy();
        const wdogeAddress = await wdoge.getAddress();
        
        // Deploy Bridge
        const BridgeFactory = await ethers.getContractFactory('DogeBridge');
        const bridge = await BridgeFactory.deploy(
            wdogeAddress,
            ethers.parseEther("1"),
            ethers.parseEther("1000000"),
            ethers.parseEther("1")
        );
        const bridgeAddress = await bridge.getAddress();
        
        // Initialize bridge service
        bridgeService = new BridgeService({
            provider,
            bridgeAddress,
            bridgeAbi: DogeBridgeArtifact.abi,
            wdogeAddress,
            wdogeAbi: WDOGEArtifact.abi,
            alertManager,
            operatorKey: deployer.privateKey,
            minConfirmations: 1
        });
    });
    
    it('should process deposits correctly', async () => {
        const amount = ethers.parseEther("1");
        const [user] = await ethers.getSigners();
        
        // Create test deposit
        const depositId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint256'],
                [user.address, amount, Date.now()]
            )
        );
        
        await bridgeService.addDeposit({
            id: depositId,
            userAddress: user.address,
            amount: amount,
            timestamp: Date.now()
        });
        
        const result = await bridgeService.processDeposit(depositId);
        expect(result.success).to.be.true;
    });
    
    it('should handle invalid deposits', async () => {
        const invalidDepositId = ethers.ZeroHash;
        const result = await bridgeService.processDeposit(invalidDepositId);
        expect(result.success).to.be.false;
        expect(result.error).to.include('Deposit not found');
    });
}); 