import { ethers } from 'ethers';
import { GasRelayer } from '../../../typechain-types/contracts/GasRelayer';
import { AlertManager } from '../monitoring/AlertManager';
import { Provider, JsonRpcProvider, Signer } from 'ethers';

interface RetryOptions {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
}

export class GasRelayerService {
    private gasRelayer: GasRelayer;
    private alertManager: AlertManager;
    private provider: Provider;
    private lastGasUpdate: number = 0;
    private readonly updateInterval: number;
    private readonly maxGasPrice: bigint;
    private readonly defaultRetryOptions: RetryOptions = {
        maxAttempts: 3,
        initialDelay: 1000, // 1 second
        maxDelay: 10000 // 10 seconds
    };

    constructor(
        gasRelayer: GasRelayer,
        alertManager: AlertManager,
        provider: Provider,
        updateInterval: number = 3600,
        maxGasPrice: bigint = ethers.parseUnits("500", "gwei")
    ) {
        this.gasRelayer = gasRelayer;
        this.alertManager = alertManager;
        this.provider = provider;
        this.updateInterval = updateInterval;
        this.maxGasPrice = maxGasPrice;
    }

    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        options: RetryOptions = this.defaultRetryOptions
    ): Promise<T> {
        let lastError: Error;
        for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                if (attempt === options.maxAttempts) {
                    throw new Error(`Failed after ${attempt} attempts. Last error: ${lastError.message}`);
                }
                const delay = Math.min(
                    options.initialDelay * Math.pow(2, attempt - 1),
                    options.maxDelay
                );
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError!;
    }

    async updateGasPrice(): Promise<void> {
        try {
            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime - this.lastGasUpdate < this.updateInterval) {
                return;
            }

            await this.retryWithBackoff(async () => {
                if (!(this.provider instanceof JsonRpcProvider)) {
                    throw new Error('Provider must be JsonRpcProvider');
                }
                const feeData = await this.provider.getFeeData();
                const currentGasPrice = feeData.gasPrice ?? BigInt(0);
                
                if (currentGasPrice > this.maxGasPrice) {
                    throw new Error(`Gas price ${ethers.formatUnits(currentGasPrice, "gwei")} gwei exceeds maximum`);
                }

                const tx = await this.gasRelayer.updateGasPrice();
                await tx.wait();
                this.lastGasUpdate = currentTime;
            });
        } catch (error) {
            await this.alertManager.sendAlert('Gas Price Update Failed', 
                `Error updating gas price: ${error.message}`);
            throw error;
        }
    }

    async compensateRelayer(relayer: string, gasUsed: number): Promise<void> {
        try {
            await this.retryWithBackoff(async () => {
                const tx = await this.gasRelayer.compensateRelayer(relayer, gasUsed);
                await tx.wait();
            });
        } catch (error) {
            await this.alertManager.sendAlert('Relayer Compensation Failed',
                `Failed to compensate relayer ${relayer}: ${error.message}`);
            throw error;
        }
    }

    async estimateRelayerFee(gasLimit: number): Promise<bigint> {
        return await this.retryWithBackoff(async () => {
            return await this.gasRelayer.estimateGasFee(gasLimit);
        });
    }

    async getRelayerBalance(relayer: string): Promise<bigint> {
        return await this.retryWithBackoff(async () => {
            return await this.gasRelayer.relayerBalances(relayer);
        });
    }

    async withdrawRelayerBalance(relayer: string, signer: Signer): Promise<void> {
        try {
            await this.retryWithBackoff(async () => {
                const tx = await this.gasRelayer.connect(signer).withdrawRelayerBalance();
                await tx.wait();
            });
        } catch (error) {
            await this.alertManager.sendAlert('Withdrawal Failed',
                `Failed to withdraw relayer balance for ${relayer}: ${error.message}`);
            throw error;
        }
    }
} 