import { DepositMonitor } from '../dogecoin/monitor/DepositMonitor';
import { WDOGEContract } from '../wdoge/WDOGEContract';
import { AddressManager } from '../dogecoin/address/AddressManager';
import { EventEmitter } from 'events';
import { Provider, ContractTransactionResponse } from 'ethers';
import { WithdrawalProcessor } from '../dogecoin/withdrawal/WithdrawalProcessor';
import { WithdrawalMonitor } from '../dogecoin/withdrawal/WithdrawalMonitor';

interface BridgeConfig {
    rpcUrl: string;
    rpcUser: string;
    rpcPassword: string;
    wdogeContractAddress: string;
    requiredConfirmations: number;
    provider: Provider;
}

interface BridgeEvent {
    type: 'deposit' | 'mint' | 'error';
    data: any;
}

interface DepositEventData {
    txid: string;
    address: string;
    amount: number;
    confirmations: number;
}

interface PendingWithdrawal {
    recipient: string;
    amount: number;
    timestamp: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
}

export class DogeBridge extends EventEmitter {
    private depositMonitor: DepositMonitor;
    private wdogeContract: WDOGEContract;
    private addressManager: AddressManager;
    private processedTxs: Set<string> = new Set();
    private readonly withdrawalProcessor: WithdrawalProcessor;
    private readonly withdrawalMonitor: WithdrawalMonitor;
    private pendingWithdrawals: Map<string, PendingWithdrawal> = new Map();

    constructor(
        config: BridgeConfig,
        wdogeContract: WDOGEContract,
        withdrawalPrivateKey: string
    ) {
        super();
        this.depositMonitor = new DepositMonitor(
            config.rpcUrl,
            config.rpcUser,
            config.rpcPassword
        );
        this.wdogeContract = wdogeContract;
        this.addressManager = new AddressManager();

        // Set up deposit monitoring
        this.depositMonitor.on('deposit', async (event: DepositEventData) => {
            try {
                await this.handleDeposit(event);
            } catch (error) {
                console.error('Error handling deposit:', error);
                this.emit('error', { type: 'deposit_processing', error });
            }
        });

        // Set up WDOGE contract events
        this.wdogeContract.onMint((to, amount) => {
            this.emit('mint', { to, amount });
        });

        // Initialize withdrawal components
        this.withdrawalProcessor = new WithdrawalProcessor(
            withdrawalPrivateKey,
            config.rpcUrl,
            config.rpcUser,
            config.rpcPassword
        );

        this.withdrawalMonitor = new WithdrawalMonitor(
            this,
            this.withdrawalProcessor,
            config.provider
        );

        // Listen for withdrawal events from the contract
        this.wdogeContract.onBurn((from, amount) => {
            this.handleWithdrawalRequest(from, amount);
        });
    }

    private async handleWithdrawalRequest(from: string, amount: number): Promise<void> {
        const withdrawal: PendingWithdrawal = {
            recipient: from,
            amount,
            timestamp: Date.now(),
            status: 'pending'
        };
        this.pendingWithdrawals.set(from, withdrawal);
        this.emit('withdrawal_requested', withdrawal);
    }

    public async getPendingWithdrawals(): Promise<PendingWithdrawal[]> {
        return Array.from(this.pendingWithdrawals.values())
            .filter(w => w.status === 'pending');
    }

    public async markWithdrawalComplete(txid: string): Promise<void> {
        for (const [address, withdrawal] of this.pendingWithdrawals) {
            if (withdrawal.status === 'processing') {
                withdrawal.status = 'completed';
                this.emit('withdrawal_completed', { txid, withdrawal });
            }
        }
    }

    public async markWithdrawalFailed(address: string, error: string): Promise<void> {
        const withdrawal = this.pendingWithdrawals.get(address);
        if (withdrawal) {
            withdrawal.status = 'failed';
            withdrawal.error = error;
            this.emit('withdrawal_failed', { address, error, withdrawal });
        }
    }

    public generateDepositAddress(userId: string): string {
        const address = this.addressManager.generateDepositAddress(userId);
        this.depositMonitor.watchAddress(address);
        return address;
    }

    private async handleDeposit(event: DepositEventData): Promise<void> {
        // Check if we've already processed this transaction
        if (this.processedTxs.has(event.txid)) {
            return;
        }

        // Get address details
        const details = this.addressManager.getAddressDetails(event.address);
        if (!details) {
            throw new Error(`Unknown deposit address: ${event.address}`);
        }

        try {
            // Mint WDOGE tokens
            const tx: ContractTransactionResponse = await this.wdogeContract.mint(details.userId, event.amount);
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new Error('Transaction failed to be mined');
            }

            // Mark transaction as processed
            this.processedTxs.add(event.txid);

            // Update address balance
            this.addressManager.updateBalance(
                event.address,
                details.balance + event.amount
            );

            // Emit success event
            this.emit('deposit', {
                txid: event.txid,
                address: event.address,
                userId: details.userId,
                amount: event.amount,
                mintTxHash: receipt.hash
            });
        } catch (error) {
            console.error('Error minting WDOGE:', error);
            throw error;
        }
    }

    public getUserAddresses(userId: string): string[] {
        return this.addressManager.getUserAddresses(userId);
    }

    public getAddressDetails(address: string): any {
        return this.addressManager.getAddressDetails(address);
    }

    public async start(): Promise<void> {
        await this.withdrawalMonitor.start();
    }

    public async stop(): Promise<void> {
        this.depositMonitor.stop();
        this.withdrawalMonitor.stop();
        // Clean up any other resources
    }
} 