export interface UTXO {
    txid: string;
    vout: number;
    value: number;
    confirmations: number;
    scriptPubKey?: string;
} 