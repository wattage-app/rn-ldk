// interface for BitcoinTransactionInput
export interface BitcoinTransactionInput {
    txid: string;
    vout: number;
    prevout: {
        scriptpubkey: string;
        scriptpubkey_asm: string;
        scriptpubkey_type: string;
        scriptpubkey_address: string;
        value: string;
    };
    scriptsig: string;
    scriptsig_asm: string;
    is_coinbase: boolean;
    sequence: number;
    witness: string[];
}

// interface for BitcoinTransactionOutput
export interface BitcoinTransactionOutput {
    value: string;
    n: number;
    scriptPubKey: {
        hex: string;
        asm: string;
        addresses: string[];
        type: string;
    };
    spentTxId: null;
    spentIndex: null;
    spentHeight: null;
}

export interface BitcoinTransaction {
    txid: string;
    version: number;
    locktime: number;
    vin: BitcoinTransactionInput[];
    vout: BitcoinTransactionOutput[];
    size: number;
    weight: number;
    fee: number;
    status: {
        confirmed: boolean;
        block_height: number;
        block_hash: string;
        block_time: number;
    };
}

export interface BitcoinTransactionMerkleProof {
    block_height: number;
    merkle: string[];
    pos: number;
}

export interface BitcoinFeeEstimates {
    fast: number;
    medium: number;
    slow: number;
}

export interface ExternalService {
    getAddressTransactions(address: string): Promise<BitcoinTransaction[]>;
    getTransaction(txid: string): Promise<BitcoinTransaction>;
    getTransactionHex(txid: string): Promise<string>;
    getTransactionMerkleProof(txid: string): Promise<BitcoinTransactionMerkleProof>;
    broadcastTransaction(txHex: string): Promise<string>;

    getBlockHash(height: number): Promise<string>;
    getBlockHeader(hash: string): Promise<any>;
    getTipHeight(): Promise<number>;
    getFeeEstimates(): Promise<BitcoinFeeEstimates>;
}
