import { DogecoinP2PKH } from '../scripts/p2pkh';
import { UTXO } from '../../../types/UTXO';
import axios from 'axios';
import { EventEmitter } from 'events';

interface WithdrawalRequest {
    toAddress: string;
    amount: number;
    fee?: number;
}

export class WithdrawalProcessor extends EventEmitter {
    private readonly rpcUrl: string;
    private readonly rpcUser: string;
    private readonly rpcPassword: string;
    private readonly dogecoin: DogecoinP2PKH;
    private readonly defaultFee = 100000; // 0.001 DOGE

    constructor(
        privateKey: string,
        rpcUrl: string,
        rpcUser: string,
        rpcPassword: string
    ) {
        super();
        this.rpcUrl = rpcUrl;
        this.rpcUser = rpcUser;
        this.rpcPassword = rpcPassword;
        this.dogecoin = new DogecoinP2PKH(privateKey);
    }

    public async processWithdrawal(request: WithdrawalRequest): Promise<string> {
        try {
            // Get UTXOs for the withdrawal
            const utxos = await this.getUTXOs(request.amount + (request.fee || this.defaultFee));
            
            // Create transaction
            const signedTx = this.dogecoin.signMessage(
                JSON.stringify({
                    utxos,
                    toAddress: request.toAddress,
                    amount: request.amount,
                    fee: request.fee || this.defaultFee
                })
            );

            // Broadcast transaction
            const txid = await this.broadcastTransaction(signedTx);
            
            this.emit('withdrawal_processed', {
                txid,
                toAddress: request.toAddress,
                amount: request.amount,
                fee: request.fee || this.defaultFee
            });
            
            return txid;
        } catch (error) {
            this.emit('withdrawal_failed', {
                error: error instanceof Error ? error.message : String(error),
                request
            });
            throw error;
        }
    }

    private async getUTXOs(requiredAmount: number): Promise<UTXO[]> {
        try {
            const response = await this.rpcCall('listunspent', [1, 9999999]);
            
            if (response.error) {
                throw new Error(`RPC Error: ${response.error.message}`);
            }

            const utxos = response.result;
            const selectedUtxos: UTXO[] = [];
            let total = 0;

            for (const utxo of utxos) {
                const formattedUtxo: UTXO = {
                    txid: utxo.txid,
                    vout: utxo.vout,
                    value: Math.floor(utxo.amount * 100000000), // Convert DOGE to satoshis
                    confirmations: utxo.confirmations,
                    scriptPubKey: utxo.scriptPubKey
                };
                selectedUtxos.push(formattedUtxo);
                total += formattedUtxo.value;
                if (total >= requiredAmount) break;
            }

            if (total < requiredAmount) {
                throw new Error('Insufficient funds for withdrawal');
            }

            return selectedUtxos;
        } catch (error) {
            console.error('Error fetching UTXOs:', error);
            throw error;
        }
    }

    private async rpcCall(method: string, params: any[]): Promise<any> {
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

    private async broadcastTransaction(txHex: string): Promise<string> {
        const response = await this.rpcCall('sendrawtransaction', [txHex]);
        if (response.error) {
            throw new Error(`Failed to broadcast transaction: ${response.error.message}`);
        }
        return response.result;
    }
} 