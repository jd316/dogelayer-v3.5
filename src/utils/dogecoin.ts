import { ethers } from 'ethers';
import { JsonRpcProvider, Contract } from 'ethers';
import { DogecoinP2WPKH } from '../services/dogecoin/scripts/p2wpkh';
import { DogeMonitor } from '../services/dogeMonitor';
import { AlertManager } from '../services/alerting';
import { logger } from './logger';

export interface DogeTransaction {
  txid: string;
  vout: {
    value: number;
    scriptPubKey: {
      addresses: string[];
    };
  }[];
  confirmations: number;
}

export interface DepositInfo {
  address: string;
  amount: number;
  account: string;
}

class DogecoinServiceError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DogecoinServiceError';
  }
}

export class DogecoinService {
  private p2wpkh: DogecoinP2WPKH;
  private depositMap: Map<string, DepositInfo>;
  private minConfirmations: number;
  private dogeMonitor: DogeMonitor;

  constructor(
    provider: JsonRpcProvider,
    bridge: Contract,
    alertManager: AlertManager,
    privateKey: string,
    minConfirmations: number = 6
  ) {
    this.p2wpkh = new DogecoinP2WPKH(privateKey);
    this.depositMap = new Map();
    this.minConfirmations = minConfirmations;
    this.dogeMonitor = new DogeMonitor(provider, bridge, alertManager, {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000
    });
  }

  async generateDepositAddress(account: string, amount: bigint): Promise<string> {
    try {
      const address = await this.p2wpkh.getAddress();
      this.depositMap.set(address, {
        address,
        amount: Number(amount),
        account
      });
      return address;
    } catch (error) {
      logger.error('Error generating deposit address:', error instanceof Error ? error : new Error(String(error)));
      throw new DogecoinServiceError('Failed to generate deposit address');
    }
  }

  async verifyTransaction(txid: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/txs/${txid}`
      );
      if (!response.ok) {
        throw new DogecoinServiceError(`API request failed: ${response.statusText}`);
      }
      const tx = await response.json();
      return tx.confirmations >= this.minConfirmations;
    } catch (error) {
      logger.error('Error verifying transaction:', error instanceof Error ? error : new Error(String(error)));
      throw error instanceof DogecoinServiceError ? error : new DogecoinServiceError('Failed to verify transaction');
    }
  }

  async getTransactionDetails(txid: string): Promise<DogeTransaction | null> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/txs/${txid}`
      );
      if (!response.ok) {
        throw new DogecoinServiceError(`API request failed: ${response.statusText}`);
      }
      const tx = await response.json();
      return {
        txid: tx.hash,
        vout: tx.outputs.map((output: any) => ({
          value: output.value / 1e8, // Convert satoshis to DOGE
          scriptPubKey: {
            addresses: output.addresses,
          },
        })),
        confirmations: tx.confirmations,
      };
    } catch (error) {
      logger.error('Error getting transaction details:', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async getAddressBalance(address: string): Promise<number> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/addrs/${address}/balance`
      );
      if (!response.ok) {
        throw new DogecoinServiceError(`API request failed: ${response.statusText}`);
      }
      const data = await response.json();
      return data.balance / 1e8; // Convert satoshis to DOGE
    } catch (error) {
      logger.error('Error getting address balance:', error instanceof Error ? error : new Error(String(error)));
      throw error instanceof DogecoinServiceError ? error : new DogecoinServiceError('Failed to get address balance');
    }
  }

  async getAddressTransactions(address: string): Promise<string[]> {
    try {
      const response = await fetch(
        `https://api.blockcypher.com/v1/doge/main/addrs/${address}/full`
      );
      if (!response.ok) {
        throw new DogecoinServiceError(`API request failed: ${response.statusText}`);
      }
      const data = await response.json();
      return data.txs.map((tx: any) => tx.hash);
    } catch (error) {
      logger.error('Error getting address transactions:', error instanceof Error ? error : new Error(String(error)));
      throw error instanceof DogecoinServiceError ? error : new DogecoinServiceError('Failed to get address transactions');
    }
  }

  getDepositInfo(address: string): DepositInfo | undefined {
    return this.depositMap.get(address);
  }

  getMonitoredAddresses(): string[] {
    return Array.from(this.depositMap.keys());
  }

  async monitorDeposit(address: string): Promise<number> {
    let confirmations = 0;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (confirmations < 6 && attempts < maxAttempts) {
      try {
        const tx = await this.verifyTransaction(address);
        if (tx) {
          confirmations = 6;
          break;
        }
      } catch (error) {
        logger.error('Error monitoring deposit:', error instanceof Error ? error : new Error(String(error)));
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    return confirmations;
  }
} 