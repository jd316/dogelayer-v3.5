import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DogeMonitor } from '../../src/services/dogeMonitor';
import { AlertManager } from '../../src/services/alerting';
import { BridgeService } from '../../src/services/bridgeService';

describe('Monitoring Service Tests', () => {
    let monitor: DogeMonitor;
    let alertManager: AlertManager;
    let bridgeService: BridgeService;
    
    beforeEach(async () => {
        // Setup alert manager
        alertManager = new AlertManager({
            webhookUrl: 'http://localhost:9000/webhook'
        });
        
        // Setup bridge service
        const [deployer] = await ethers.getSigners();
        const provider = new ethers.JsonRpcProvider('http://localhost:8545');
        
        bridgeService = new BridgeService({
            provider,
            bridgeAddress: ethers.ZeroAddress, // Mock address for testing
            wdogeAddress: ethers.ZeroAddress,  // Mock address for testing
            operatorKey: deployer.privateKey,
            minConfirmations: 6,
            alertManager
        });
        
        // Setup monitor
        monitor = new DogeMonitor(provider, bridgeService, alertManager);
    });
    
    describe('Transaction Processing', () => {
        it('should process valid transactions', async () => {
            const txHash = '0x123';
            const amount = ethers.parseEther('1');
            const [user] = await ethers.getSigners();
            
            // Add deposit info before processing
            await monitor.addDepositInfo(txHash, {
                amount,
                userAddress: user.address,
                timestamp: Date.now()
            });
            
            const result = await monitor.processTransaction(txHash);
            expect(result.success).to.be.true;
        });
        
        it('should handle insufficient confirmations', async () => {
            const txHash = '0x456';
            const amount = ethers.parseEther('1');
            const [user] = await ethers.getSigners();
            
            // Add deposit with insufficient confirmations
            await monitor.addDepositInfo(txHash, {
                amount,
                userAddress: user.address,
                timestamp: Date.now(),
                confirmations: 2 // Less than required 6
            });
            
            const result = await monitor.processTransaction(txHash);
            expect(result.success).to.be.false;
            expect(result.error).to.include('Insufficient confirmations');
        });
    });
    
    describe('Health Monitoring', () => {
        it('should report healthy status when operating normally', async () => {
            const health = await monitor.getHealthStatus();
            expect(health.status).to.equal('healthy');
        });
        
        it('should track errors correctly', async () => {
            // Simulate some errors
            monitor.recordError(new Error('Test error 1'));
            monitor.recordError(new Error('Test error 2'));
            
            const health = await monitor.getHealthStatus();
            expect(health.errors.length).to.equal(2);
        });
    });
    
    describe('Alert System', () => {
        it('should trigger alerts for critical errors', async () => {
            // Simulate a critical error
            monitor.recordError(new Error('Critical test error'), 'critical');
            
            const lastAlert = monitor.getLastAlert();
            expect(lastAlert?.severity).to.equal('critical');
        });
    });
}); 