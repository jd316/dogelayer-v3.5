import { ethers } from 'ethers';
import { DogeBridge } from './services/bridge/DogeBridge';
import { WDOGEContract } from './services/wdoge/WDOGEContract';
import { AlertManager } from './services/alerting';
import { logger } from './utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    try {
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'http://localhost:8545');
        
        // Initialize contracts
        const wdogeContract = new WDOGEContract(
            process.env.WDOGE_CONTRACT_ADDRESS!,
            provider,
            new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY!, provider)
        );

        // Initialize alert manager
        const alertManager = new AlertManager({
            webhookUrl: process.env.ALERT_WEBHOOK_URL
        });

        // Initialize bridge service
        const bridge = new DogeBridge(
            {
                rpcUrl: process.env.DOGE_RPC_URL || 'http://localhost:8332',
                rpcUser: process.env.DOGE_RPC_USER || 'user',
                rpcPassword: process.env.DOGE_RPC_PASSWORD || 'pass',
                wdogeContractAddress: process.env.WDOGE_CONTRACT_ADDRESS!,
                requiredConfirmations: parseInt(process.env.MIN_CONFIRMATIONS || '6'),
                provider
            },
            wdogeContract,
            process.env.DOGE_PRIVATE_KEY!
        );

        // Start bridge service
        await bridge.start();
        logger.info('Bridge service started successfully');

        // Handle shutdown gracefully
        process.on('SIGINT', async () => {
            logger.info('Shutting down bridge service...');
            await bridge.stop();
            process.exit(0);
        });

    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to start bridge service', err);
        process.exit(1);
    }
}

main().catch((error) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Unhandled error', err);
    process.exit(1);
}); 