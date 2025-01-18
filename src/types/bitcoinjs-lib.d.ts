declare module 'bitcoinjs-lib' {
    export interface Network {
        messagePrefix: string;
        bech32: string;
        bip32: {
            public: number;
            private: number;
        };
        pubKeyHash: number;
        scriptHash: number;
        wif: number;
        witnessVersion?: number;
        witnessHashType?: string;
    }

    export interface TransactionInput {
        hash: Buffer;
        index: number;
        script: Buffer;
        sequence: number;
        witness: Buffer[];
    }

    export interface TransactionOutput {
        value: number;
        script: Buffer;
    }

    export interface Payment {
        name?: string;
        address?: string;
        hash?: Buffer;
        output?: Buffer;
        redeem?: Payment;
        input?: Buffer;
        witness?: Buffer[];
        pubkey?: Buffer;
        signature?: Buffer;
        network?: Network;
        data?: Buffer[];
    }

    export interface PaymentCreator {
        (args: { pubkey: Buffer; network?: Network }): Payment;
        (args: { hash: Buffer; network?: Network }): Payment;
        (args: { redeem: Payment; network?: Network }): Payment;
        (args: { witness: Buffer[]; network?: Network }): Payment;
    }

    export const Transaction: {
        new(): {
            version: number;
            locktime: number;
            ins: TransactionInput[];
            outs: TransactionOutput[];
            toHex(): string;
            toBuffer(): Buffer;
            getId(): string;
            getHash(): Buffer;
            virtualSize(): number;
            weight(): number;
        };
        fromHex(hex: string): {
            version: number;
            locktime: number;
            ins: TransactionInput[];
            outs: TransactionOutput[];
            toHex(): string;
            toBuffer(): Buffer;
            getId(): string;
            getHash(): Buffer;
            virtualSize(): number;
            weight(): number;
        };
        fromBuffer(buffer: Buffer): {
            version: number;
            locktime: number;
            ins: TransactionInput[];
            outs: TransactionOutput[];
            toHex(): string;
            toBuffer(): Buffer;
            getId(): string;
            getHash(): Buffer;
            virtualSize(): number;
            weight(): number;
        };
    };

    export namespace payments {
        export const p2wpkh: PaymentCreator;
        export const p2pkh: PaymentCreator;
        export const p2sh: PaymentCreator;
        export const p2wsh: PaymentCreator;
    }

    export class TransactionBuilder {
        constructor(network?: Network);
        setVersion(version: number): void;
        addInput(
            txHash: string | Buffer,
            vout: number,
            sequence?: number,
            prevOutScript?: Buffer
        ): void;
        addOutput(scriptPubKey: string | Buffer, value: number): void;
        sign(options: {
            prevOutScriptType: 'p2wpkh' | 'p2pkh' | 'p2sh' | 'p2wsh';
            vin: number;
            keyPair: ECPairInterface;
            witnessValue?: number;
            redeemScript?: Buffer;
            witnessScript?: Buffer;
            hashType?: number;
        }): void;
        build(): {
            version: number;
            locktime: number;
            ins: TransactionInput[];
            outs: TransactionOutput[];
            toHex(): string;
            toBuffer(): Buffer;
            getId(): string;
            getHash(): Buffer;
            virtualSize(): number;
            weight(): number;
        };
    }

    export namespace crypto {
        export function hash256(buffer: Buffer): Buffer;
        export function hash160(buffer: Buffer): Buffer;
        export function sha256(buffer: Buffer): Buffer;
        export function ripemd160(buffer: Buffer): Buffer;
    }

    export const script: {
        compile(asm: (string | Buffer | number)[]): Buffer;
        decompile(buffer: Buffer): (string | Buffer | number)[];
        number: {
            encode(number: number): Buffer;
            decode(buffer: Buffer, maxLength?: number): number;
        };
        types: {
            P2WSH: 'p2wsh';
            P2WPKH: 'p2wpkh';
            P2SH: 'p2sh';
            P2PKH: 'p2pkh';
        };
    };
}

declare module 'ecpair' {
    import { Network } from 'bitcoinjs-lib';

    export interface ECPairInterface {
        publicKey: Buffer;
        privateKey?: Buffer;
        compressed: boolean;
        network?: Network;
        sign(hash: Buffer): Buffer;
        verify(hash: Buffer, signature: Buffer): boolean;
        toWIF(): string;
    }

    export interface ECPairOptions {
        compressed?: boolean;
        network?: Network;
        rng?(size: number): Buffer;
    }

    export interface ECPairAPI {
        (options?: ECPairOptions): ECPairInterface;
        fromPrivateKey(buffer: Buffer, options?: ECPairOptions): ECPairInterface;
        fromWIF(wif: string, network?: Network): ECPairInterface;
        makeRandom(options?: ECPairOptions): ECPairInterface;
    }

    export function ECPairFactory(ecc: {
        sign(hash: Buffer, privateKey: Buffer): Buffer;
        verify(hash: Buffer, signature: Buffer, publicKey: Buffer): boolean;
        isPoint(p: Uint8Array): boolean;
        isPrivate(d: Uint8Array): boolean;
    }): ECPairAPI;
}

declare module 'tiny-secp256k1' {
    export function isPoint(p: Uint8Array): boolean;
    export function isPrivate(d: Uint8Array): boolean;
    export function pointAdd(a: Uint8Array, b: Uint8Array): Uint8Array;
    export function pointAddScalar(p: Uint8Array, tweak: Uint8Array): Uint8Array;
    export function pointCompress(p: Uint8Array, compressed?: boolean): Uint8Array;
    export function pointFromScalar(d: Uint8Array, compressed?: boolean): Uint8Array;
    export function pointMultiply(p: Uint8Array, tweak: Uint8Array): Uint8Array;
    export function privateAdd(d: Uint8Array, tweak: Uint8Array): Uint8Array;
    export function privateSub(d: Uint8Array, tweak: Uint8Array): Uint8Array;
    export function sign(h: Uint8Array, d: Uint8Array): Uint8Array;
    export function verify(h: Uint8Array, Q: Uint8Array, signature: Uint8Array): boolean;
} 