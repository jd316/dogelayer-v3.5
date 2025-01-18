import { ethers } from 'ethers';
import { 
  Contract, 
  JsonRpcProvider, 
  ContractTransaction, 
  ContractTransactionResponse,
  BaseContract,
  ContractMethod
} from 'ethers';
import { formatUnits, parseUnits } from '@ethersproject/units';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { AlertManager } from './alerting';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

interface DogeMonitorConfig {
  provider: JsonRpcProvider;
  bridgeAddress: string;
  bridgeAbi: any;
  minConfirmations?: number;
  retryConfig?: RetryConfig;
  alertConfig?: {
    webhookUrl?: string;
    emailConfig?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
}

interface BridgeContract extends BaseContract {
  processedDeposits(depositId: string): Promise<boolean>;
  processDeposit(account: string, amount: bigint, depositId: string): Promise<ContractTransactionResponse>;
}

interface DogeTransaction {
  txid: string;
  vout: number;
  value: number;
  confirmations: number;
}

interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  errors: string[];
}

interface Transaction {
  hash: string;
  recipient: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

interface MonitorAlert {
  type: 'monitor';
  message: string;
  severity: 'warning' | 'critical';
  timestamp: number;
}

class DogeMonitorError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DogeMonitorError';
  }
}

export class TransactionValidationError extends DogeMonitorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class TransactionProcessingError extends DogeMonitorError {
  constructor(message: string) {
    super(message, 'PROCESSING_ERROR');
  }
}

export class NetworkError extends DogeMonitorError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
  }
}

export class DogeMonitor {
  private readonly provider: JsonRpcProvider;
  private readonly bridge: BridgeContract;
  private readonly alertManager: AlertManager;
  private readonly retryConfig: RetryConfig = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000
  };
  private readonly processingQueue: Map<string, Transaction> = new Map();
  private readonly backoffFactor = 1.5;
  private readonly minConfirmations = 6;
  private readonly addressMap: Map<string, { account: string; amount: number }> = new Map();
  private readonly errors: string[] = [];
  private readonly maxErrorsStored = 10;
  private lastProcessedTime = 0;
  private lastHealthCheck: Date = new Date();

  constructor(
    provider: JsonRpcProvider,
    bridge: Contract,
    alertManager: AlertManager,
    config?: Partial<RetryConfig>
  ) {
    this.provider = provider;
    this.bridge = bridge as unknown as BridgeContract;
    this.alertManager = alertManager;
    if (config) {
      this.retryConfig = { ...this.retryConfig, ...config };
    }
  }

  async processTransaction(txn: DogeTransaction): Promise<void> {
    if (txn.confirmations < this.minConfirmations) {
      throw new TransactionValidationError(`Insufficient confirmations: ${txn.confirmations} < ${this.minConfirmations}`);
    }

    const txKey = txn.txid;
    if (this.processingQueue.has(txKey)) {
      throw new TransactionValidationError(`Transaction ${txKey} is already being processed`);
    }

    try {
      const depositInfo = this.addressMap.get(txn.txid);
      if (!depositInfo) {
        throw new TransactionValidationError(`No deposit info found for transaction ${txKey}`);
      }

      this.processingQueue.set(txKey, {
        hash: txn.txid,
        recipient: depositInfo.account,
        amount: txn.value,
        status: 'pending'
      });

      const depositId = keccak256(toUtf8Bytes(txn.txid));
      const isProcessed = await this.bridge.processedDeposits(depositId);
      
      if (!isProcessed) {
        const amountBigInt = BigInt(parseUnits(txn.value.toString(), 8).toString());
        try {
          const transaction = await this.bridge.processDeposit(
            depositInfo.account,
            amountBigInt,
            depositId
          ) as ContractTransactionResponse;
          await transaction.wait();
        } catch (error) {
          throw new TransactionProcessingError(
            `Failed to process deposit: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      this.processingQueue.set(txKey, {
        hash: txn.txid,
        recipient: depositInfo.account,
        amount: txn.value,
        status: 'confirmed'
      });

      this.lastProcessedTime = Date.now();
    } catch (error) {
      if (error instanceof Error) {
        this.handleError(error);
      } else {
        this.handleError(new NetworkError('Unknown error processing transaction'));
      }
      this.processingQueue.set(txKey, {
        hash: txn.txid,
        recipient: '',
        amount: txn.value,
        status: 'failed'
      });
      throw error;
    }
  }

  private handleError(error: Error): void {
    this.errors.push(error.message);
    if (this.errors.length > this.maxErrorsStored) {
      this.errors.shift();
    }
    
    const severity = error instanceof TransactionProcessingError ? 'critical' : 'warning';
    
    this.alertManager.sendAlert({
      type: 'monitor',
      message: error.message,
      severity,
      timestamp: Date.now(),
      metadata: {
        metrics: {
          successRate: this.calculateSuccessRate(),
          errorCount: this.errors.length,
          lastError: {
            message: error.message,
            timestamp: Date.now(),
            count: this.countSimilarErrors(error.message)
          }
        }
      }
    });
  }

  private calculateSuccessRate(): number {
    const total = Array.from(this.processingQueue.values()).length;
    if (total === 0) return 100;
    
    const successful = Array.from(this.processingQueue.values())
      .filter(tx => tx.status === 'confirmed')
      .length;
    
    // Track metrics
    metrics.recordValue('doge_monitor_transactions_total', total);
    metrics.recordValue('doge_monitor_transactions_successful', successful);
    
    // Calculate success rate with 2 decimal precision
    const rate = Math.round((successful / total) * 10000) / 100;
    metrics.recordValue('doge_monitor_success_rate', rate);
    
    return rate;
  }

  private countSimilarErrors(message: string): number {
    return this.errors.filter(err => err === message).length;
  }

  getHealthStatus(): HealthStatus {
    const now = new Date();
    const timeSinceLastProcess = now.getTime() - this.lastProcessedTime;
    const successRate = this.calculateSuccessRate();
    
    return {
      isHealthy: this.errors.length === 0 && successRate >= 90,
      lastCheck: now,
      errors: [...this.errors]
    };
  }
} 