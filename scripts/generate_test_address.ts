import { DogecoinP2PKH } from '../src/services/dogecoin/scripts/p2pkh';
import { randomBytes } from 'crypto';

// Generate a secure random private key
const testPrivateKey = randomBytes(32).toString('hex');

async function main() {
    try {
        // Create P2PKH instance for legacy address
        console.log("Creating P2PKH instance...");
        const dogecoin = new DogecoinP2PKH(testPrivateKey);

        // Generate legacy address
        console.log("\nGenerating legacy Dogecoin address...");
        const address = dogecoin.generateAddress();

        console.log("\nGenerated Address Details:");
        console.log("-------------------------");
        console.log("Address:", address);
        console.log("Private Key:", testPrivateKey);
        console.log("\nIMPORTANT: Keep this private key secret! Never share it with anyone!");
        console.log("\nYou can verify this address at:");
        console.log(`https://sochain.com/address/DOGE/${address}`);
        
        // Validate address format (should start with 'D')
        if (!address.startsWith('D')) {
            throw new Error('Invalid address format - should start with "D"');
        }
        
        console.log("\nAddress validation passed ✓");
        console.log("Address format is valid (starts with 'D')");
        
    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
    }
}

main().catch(console.error); 