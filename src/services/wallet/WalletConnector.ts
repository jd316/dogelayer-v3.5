import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { EventEmitter } from 'events';

export interface WalletState {
    isConnected: boolean;
    address: string | null;
    chainId: number | null;
    provider: BrowserProvider | null;
    signer: JsonRpcSigner | null;
}

export class WalletConnector extends EventEmitter {
    private state: WalletState;

    constructor() {
        super();
        this.state = {
            isConnected: false,
            address: null,
            chainId: null,
            provider: null,
            signer: null
        };
    }

    async connect(): Promise<WalletState> {
        try {
            if (!window.ethereum) {
                throw new Error('No Ethereum provider found');
            }

            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            const network = await provider.getNetwork();

            this.state = {
                isConnected: true,
                address,
                chainId: Number(network.chainId),
                provider,
                signer
            };

            this.setupEventListeners();
            this.emit('connected', this.state);
            return this.state;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        this.state = {
            isConnected: false,
            address: null,
            chainId: null,
            provider: null,
            signer: null
        };
        this.emit('disconnected');
    }

    private setupEventListeners(): void {
        if (!window.ethereum) return;

        window.ethereum.on('accountsChanged', async (accounts: string[]) => {
            if (accounts.length === 0) {
                await this.disconnect();
            } else {
                this.state.address = accounts[0];
                this.emit('accountChanged', accounts[0]);
            }
        });

        window.ethereum.on('chainChanged', (chainId: string) => {
            this.state.chainId = Number(chainId);
            this.emit('chainChanged', Number(chainId));
        });

        window.ethereum.on('disconnect', () => {
            this.disconnect();
        });
    }

    getState(): WalletState {
        return { ...this.state };
    }

    async switchNetwork(chainId: number): Promise<void> {
        if (!window.ethereum) {
            throw new Error('No Ethereum provider found');
        }

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }]
            });
        } catch (error: any) {
            if (error.code === 4902) {
                throw new Error('Network not added to wallet');
            }
            throw error;
        }
    }
} 