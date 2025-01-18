export class P2PKHError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'P2PKHError';
    }
} 