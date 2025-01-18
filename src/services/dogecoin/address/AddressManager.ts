import { DogecoinP2PKH } from '../scripts/p2pkh';
import { randomBytes } from 'crypto';

interface AddressDetails {
    userId: string;
    address: string;
    privateKey: string;
    balance: number;
    createdAt: Date;
}

export class AddressManager {
    private addresses: Map<string, AddressDetails> = new Map();
    private userAddresses: Map<string, Set<string>> = new Map();

    public generateDepositAddress(userId: string): string {
        // Generate random private key
        const privateKey = randomBytes(32).toString('hex');
        
        // Create P2PKH instance for legacy address
        const dogecoin = new DogecoinP2PKH(privateKey);
        const address = dogecoin.generateAddress();

        // Store address details
        const details: AddressDetails = {
            userId,
            address,
            privateKey,
            balance: 0,
            createdAt: new Date()
        };
        this.addresses.set(address, details);

        // Track address for user
        if (!this.userAddresses.has(userId)) {
            this.userAddresses.set(userId, new Set());
        }
        this.userAddresses.get(userId)!.add(address);

        return address;
    }

    public getAddressDetails(address: string): AddressDetails | undefined {
        return this.addresses.get(address);
    }

    public getUserAddresses(userId: string): string[] {
        const addresses = this.userAddresses.get(userId);
        return addresses ? Array.from(addresses) : [];
    }

    public updateBalance(address: string, newBalance: number): void {
        const details = this.addresses.get(address);
        if (details) {
            details.balance = newBalance;
        }
    }

    public isAddressOwner(userId: string, address: string): boolean {
        const details = this.addresses.get(address);
        return details?.userId === userId;
    }

    public getPrivateKey(address: string): string | undefined {
        return this.addresses.get(address)?.privateKey;
    }
} 