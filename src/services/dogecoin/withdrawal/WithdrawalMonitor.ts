import { Provider } from 'ethers';
import { DogeBridge } from '../../bridge/DogeBridge';
import { WithdrawalProcessor } from './WithdrawalProcessor';
import { logger } from '../../../utils/logger';

export class WithdrawalMonitor {
    private isMonitoring = false;
    private readonly monitoringInterval = 60000; // 1 minute

    constructor(
        private readonly bridge: DogeBridge,
        private readonly withdrawalProcessor: WithdrawalProcessor,
        private readonly provider: Provider
    ) {}

    public async start(): Promise<void> {
        if (this.isMonitoring) {
            throw new Error('Monitoring is already active');
        }

        this.isMonitoring = true;
        this.setupEventListeners();

        // Start monitoring for withdrawal events
        setInterval(async () => {
            try {
                await this.checkPendingWithdrawals();
            } catch (error) {
                logger.error('Error checking withdrawals', error instanceof Error ? error : new Error(String(error)));
            }
        }, this.monitoringInterval);
    }

    private async checkPendingWithdrawals(): Promise<void> {
        try {
            // Get pending withdrawals from bridge contract
            const withdrawals = await this.bridge.getPendingWithdrawals();

            for (const withdrawal of withdrawals) {
                await this.withdrawalProcessor.processWithdrawal({
                    toAddress: withdrawal.recipient,
                    amount: withdrawal.amount
                });
            }
        } catch (error) {
            logger.error('Failed to process withdrawals', error instanceof Error ? error : new Error(String(error)));
        }
    }

    private setupEventListeners(): void {
        this.withdrawalProcessor.on('withdrawal_processed', async (data) => {
            logger.info('Withdrawal processed successfully', { data });
            await this.bridge.markWithdrawalComplete(data.txid);
        });

        this.withdrawalProcessor.on('withdrawal_failed', async (data) => {
            logger.error('Withdrawal failed', new Error(data.error));
            await this.bridge.markWithdrawalFailed(data.request.toAddress, data.error);
        });
    }

    public stop(): void {
        this.isMonitoring = false;
        this.withdrawalProcessor.removeAllListeners();
    }
} 