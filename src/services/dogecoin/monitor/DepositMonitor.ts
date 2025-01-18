import { EventEmitter } from 'events';
import { UTXO } from '../../../types/UTXO';
import axios from 'axios';

interface DepositEvent {
    address: string;
    txid: string;
    amount: number;
    confirmations: number;
}

interface RPCResponse {
    result: any;
    error: any;
    id: string;
}

export class DepositMonitor extends EventEmitter {
    private watchedAddresses: Set<string> = new Set();
    private readonly REQUIRED_CONFIRMATIONS = 6;
    private readonly POLLING_INTERVAL = 60000; // 1 minute
    private intervalId?: NodeJS.Timeout;
    private processedTxs: Set<string> = new Set();

    constructor(
        private readonly rpcUrl: string,
        private readonly rpcUser: string,
        private readonly rpcPassword: string
    ) {
        super();
    }

    public watchAddress(address: string): void {
        this.watchedAddresses.add(address);
        if (!this.intervalId) {
            this.startPolling();
        }
    }

    public unwatchAddress(address: string): void {
        this.watchedAddresses.delete(address);
        if (this.watchedAddresses.size === 0 && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    private async startPolling(): Promise<void> {
        this.intervalId = setInterval(async () => {
            try {
                await this.checkDeposits();
            } catch (error) {
                console.error('Error checking deposits:', error);
            }
        }, this.POLLING_INTERVAL);
    }

    private async checkDeposits(): Promise<void> {
        for (const address of this.watchedAddresses) {
            try {
                const utxos = await this.fetchUTXOs(address);
                for (const utxo of utxos) {
                    // Skip if we've already processed this transaction
                    if (this.processedTxs.has(utxo.txid)) {
                        continue;
                    }

                    if (utxo.confirmations >= this.REQUIRED_CONFIRMATIONS) {
                        const event: DepositEvent = {
                            address,
                            txid: utxo.txid,
                            amount: utxo.value,
                            confirmations: utxo.confirmations
                        };
                        this.emit('deposit', event);
                        this.processedTxs.add(utxo.txid);
                    }
                }
            } catch (error) {
                console.error(`Error checking deposits for address ${address}:`, error);
            }
        }
    }

    private async fetchUTXOs(address: string): Promise<UTXO[]> {
        try {
            // First, get all transactions for the address
            const response = await this.rpcCall('listunspent', [0, 9999999, [address]]);
            
            if (response.error) {
                throw new Error(`RPC Error: ${response.error.message}`);
            }

            return response.result.map((utxo: any) => ({
                txid: utxo.txid,
                vout: utxo.vout,
                value: Math.floor(utxo.amount * 100000000), // Convert DOGE to satoshis
                confirmations: utxo.confirmations,
                scriptPubKey: utxo.scriptPubKey
            }));
        } catch (error) {
            console.error('Error fetching UTXOs:', error);
            throw error;
        }
    }

    private async rpcCall(method: string, params: any[]): Promise<RPCResponse> {
        try {
            const response = await axios.post(
                this.rpcUrl,
                {
                    jsonrpc: '2.0',
                    id: Date.now().toString(),
                    method,
                    params
                },
                {
                    auth: {
                        username: this.rpcUser,
                        password: this.rpcPassword
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('RPC call failed:', error);
            throw error;
        }
    }

    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.watchedAddresses.clear();
        this.processedTxs.clear();
    }
} 