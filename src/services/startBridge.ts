import { config } from 'dotenv';
import { BridgeService } from '../services/bridgeService';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';

// Load environment variables
config();

async function main() {
  const {
    POLYGON_RPC_URL,
    BRIDGE_CONTRACT_ADDRESS,
    ADMIN_PRIVATE_KEY,
    MIN_CONFIRMATIONS,
    CIRCUIT_BREAKER_THRESHOLD,
    CIRCUIT_BREAKER_TIMEOUT
  } = process.env;

  if (!POLYGON_RPC_URL || !BRIDGE_CONTRACT_ADDRESS || !ADMIN_PRIVATE_KEY) {
    throw new Error('Missing required environment variables');
  }

  try {
    // Initialize bridge service with validated configuration
    const bridgeService = new BridgeService({
      providerUrl: POLYGON_RPC_URL,
      bridgeAddress: BRIDGE_CONTRACT_ADDRESS,
      bridgeAbi: [], // ABI will be loaded from artifacts
      minConfirmations: MIN_CONFIRMATIONS ? parseInt(MIN_CONFIRMATIONS) : 6,
      circuitBreakerConfig: {
        failureThreshold: CIRCUIT_BREAKER_THRESHOLD ? parseInt(CIRCUIT_BREAKER_THRESHOLD) : 5,
        resetTimeout: CIRCUIT_BREAKER_TIMEOUT ? parseInt(CIRCUIT_BREAKER_TIMEOUT) : 60000
      }
    });

    logger.info('Starting bridge monitoring service...', {
      network: POLYGON_RPC_URL,
      minConfirmations: MIN_CONFIRMATIONS,
      circuitBreakerThreshold: CIRCUIT_BREAKER_THRESHOLD
    });
    
    // Start monitoring Dogecoin transactions
    await bridgeService.monitorDogeTransactions();

    // Keep the process running
    process.on('SIGINT', () => {
      logger.info('Shutting down bridge monitoring service...');
      process.exit();
    });

    process.on('unhandledRejection', (error: unknown) => {
      if (error instanceof Error) {
        logger.error('Unhandled promise rejection:', error);
      } else {
        logger.error('Unhandled promise rejection:', new Error(String(error)));
      }
    });

    process.on('uncaughtException', (error: unknown) => {
      if (error instanceof Error) {
        logger.error('Uncaught exception:', error);
      } else {
        logger.error('Uncaught exception:', new Error(String(error)));
      }
      process.exit(1);
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error starting bridge service:', error);
    } else {
      logger.error('Error starting bridge service:', new Error(String(error)));
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    logger.error('Error in main:', error);
  } else {
    logger.error('Error in main:', new Error(String(error)));
  }
  process.exit(1);
}); 