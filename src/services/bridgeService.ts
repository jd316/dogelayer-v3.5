import { 
  JsonRpcProvider,
  Contract, 
  Signer,
  isAddress,
  id
} from 'ethers';
import { parseUnits } from '@ethersproject/units';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import axios, { AxiosError } from 'axios';
import { DogeBridge } from '../types/contracts';
import { CircuitBreaker } from '../utils/circuitBreaker';
import { logger } from '../utils/logger';
import { DogecoinP2PKH } from '../services/dogecoin/scripts/p2pkh';

interface DogeTransaction {
  txid: string;
  amount: number;
  recipient: string;
  confirmations: number;
  timestamp?: number;
}

interface BitqueryResponse {
  data: {
    bitcoin: {
      transactions: Array<{
        hash: string;
        amount: number;
        recipient: string;
        block: {
          confirmations: number;
          timestamp: {
            time: string;
          };
        };
      }>;
    };
  };
}

interface BridgeServiceConfig {
  providerUrl: string;
  bridgeAddress: string;
  bridgeAbi: any;
  minConfirmations?: number;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    resetTimeout?: number;
  };
  privateKey: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class BridgeService {
  private provider: JsonRpcProvider;
  private bridge: DogeBridge;
  private minConfirmations: number;
  private circuitBreaker: CircuitBreaker;
  private readonly MAX_RETRIES = 3;
  private readonly RESET_TIMEOUT = 60000; // 1 minute
  private isMonitoring = false;
  private p2pkh: DogecoinP2PKH;
  private signer: Signer;

  constructor(config: BridgeServiceConfig) {
    this.validateConfig(config);

    this.provider = new JsonRpcProvider(config.providerUrl);
    this.signer = new (require('ethers').Wallet)(config.privateKey, this.provider) as Signer;
    this.bridge = new Contract(
      config.bridgeAddress,
      config.bridgeAbi,
      this.signer
    ) as DogeBridge;
    this.minConfirmations = config.minConfirmations || 6;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.circuitBreakerConfig?.failureThreshold || 5,
      resetTimeout: config.circuitBreakerConfig?.resetTimeout || this.RESET_TIMEOUT
    });
    this.p2pkh = new DogecoinP2PKH(config.privateKey);
  }

  private validateConfig(config: BridgeServiceConfig): void {
    if (!config.providerUrl) {
      throw new ConfigurationError('Provider URL is required');
    }

    if (!config.providerUrl.startsWith('http://') && !config.providerUrl.startsWith('https://')) {
      throw new ConfigurationError('Invalid provider URL format');
    }

    if (!config.bridgeAddress) {
      throw new ConfigurationError('Bridge address is required');
    }

    if (!isAddress(config.bridgeAddress)) {
      throw new ConfigurationError('Invalid bridge address format');
    }

    if (!config.bridgeAbi || !Array.isArray(config.bridgeAbi)) {
      throw new ConfigurationError('Bridge ABI must be a valid array');
    }

    if (!config.privateKey) {
      throw new ConfigurationError('Private key is required');
    }

    // Ensure private key is in correct format (hex string without 0x prefix)
    const privateKeyRegex = /^[0-9a-fA-F]{64}$/;
    const privateKey = config.privateKey.startsWith('0x') 
        ? config.privateKey.slice(2) 
        : config.privateKey;
        
    if (!privateKeyRegex.test(privateKey)) {
        throw new ConfigurationError("Invalid private key format - must be 32 bytes hex");
    }

    if (config.minConfirmations !== undefined && (
      typeof config.minConfirmations !== 'number' ||
      config.minConfirmations < 1 ||
      !Number.isInteger(config.minConfirmations)
    )) {
      throw new ConfigurationError('Minimum confirmations must be a positive integer');
    }

    if (config.circuitBreakerConfig) {
      if (
        config.circuitBreakerConfig.failureThreshold !== undefined &&
        (typeof config.circuitBreakerConfig.failureThreshold !== 'number' ||
        config.circuitBreakerConfig.failureThreshold < 1 ||
        !Number.isInteger(config.circuitBreakerConfig.failureThreshold))
      ) {
        throw new ConfigurationError('Circuit breaker failure threshold must be a positive integer');
      }

      if (
        config.circuitBreakerConfig.resetTimeout !== undefined &&
        (typeof config.circuitBreakerConfig.resetTimeout !== 'number' ||
        config.circuitBreakerConfig.resetTimeout < 1000)
      ) {
        throw new ConfigurationError('Circuit breaker reset timeout must be at least 1000ms');
      }
    }
  }

  async monitorDogeTransactions(): Promise<void> {
    if (this.isMonitoring) {
      throw new Error('Monitoring is already active');
    }

    this.isMonitoring = true;
    
    const monitoringInterval = setInterval(async () => {
      try {
        const transactions = await this.circuitBreaker.execute(async () => {
          const response = await axios.post<BitqueryResponse>(
            'https://graphql.bitquery.io',
            {
              query: `
                query ($network: BitcoinNetwork!, $limit: Int!, $offset: Int!) {
                  bitcoin(network: $network) {
                    transactions(
                      options: {limit: $limit, offset: $offset}
                      date: {since: null}
                    ) {
                      hash
                      amount
                      recipient
                      block {
                        confirmations
                        timestamp {
                          time
                        }
                      }
                    }
                  }
                }
              `,
              variables: {
                network: 'dogecoin',
                limit: 100,
                offset: 0
              }
            },
            {
              headers: {
                'X-API-KEY': process.env.BITQUERY_API_KEY || ''
              }
            }
          );

          return this.transformBitqueryResponse(response.data);
        });

        for (const tx of transactions) {
          if (tx.confirmations >= this.minConfirmations) {
            try {
              const depositId = id(tx.txid);
              const isProcessed = await this.bridge.processedDeposits(depositId);
              
              if (!isProcessed) {
                const amountBigInt = BigInt(parseUnits(tx.amount.toString(), 8).toString());
                
                // Generate signature for the deposit
                const message = keccak256(
                  toUtf8Bytes(
                    `${tx.recipient}${amountBigInt.toString()}${depositId}`
                  )
                );
                const signature = await this.signer.signMessage(message);

                const transaction = await this.bridge.processDeposit(
                  tx.recipient,
                  amountBigInt,
                  depositId,
                  signature
                );
                await transaction.wait();
                logger.info(`Processed deposit for transaction ${tx.txid}`, {
                  amount: tx.amount,
                  recipient: tx.recipient,
                  confirmations: tx.confirmations
                });
              }
            } catch (error) {
              if (error instanceof Error) {
                logger.error(`Error processing transaction ${tx.txid}:`, error);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          logger.error('Error in monitoring cycle:', error);
        }
      }
    }, 60000); // Check every minute

    // Cleanup on process exit
    process.on('SIGINT', () => {
      clearInterval(monitoringInterval);
      this.isMonitoring = false;
      process.exit();
    });
  }

  private transformBitqueryResponse(response: BitqueryResponse): DogeTransaction[] {
    return response.data.bitcoin.transactions.map(tx => ({
      txid: tx.hash,
      amount: tx.amount,
      recipient: tx.recipient,
      confirmations: tx.block.confirmations,
      timestamp: new Date(tx.block.timestamp.time).getTime()
    }));
  }
} 