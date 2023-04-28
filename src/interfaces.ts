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

export interface DecodedInvoice {
    payee_pubkey: string;
    millisatoshis: number;
    tags: {
        payment_hash: string;
        payment_secret: string;
        description: string;
        expiry_time: number;
        min_final_cltv_expiry: number;
        features: string;
    }
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
    scriptToAddress(script: string): Promise<string>;
    decodeInvoice(invoice: string): Promise<DecodedInvoice>;
    queryRoutes(pubkey: string, amtMsat: number): Promise<RouteQueryResponse>;
    getChannelInfo(channelId: string): Promise<ChanInfo>;
}

export interface RouteQueryResponse {
    routes: RouteQuery[];
    success_prob: number;
}

export interface RouteQuery {
    total_time_lock: number;
    total_fees_msat: number;
    total_amt_msat: number;
    hops: RouteHop[];
}

export interface RouteHop {
    chan_id: string;
    chan_capacity: string;
    expiry: number;
    amt_to_forward_msat: number;
    fee_msat: number;
    pub_key: string;
    tlv_payload: boolean;
}

export interface NodePolicy {
    time_lock_delta: number;
    min_htlc: number;
    fee_base_msat: number;
    fee_rate_milli_msat: number;
    disabled: boolean;
    max_htlc_msat: number;
    last_update: number;
}

export interface ChanInfo {
    channel_id: string;
    chan_point: string;
    node1_pub: string;
    node2_pub: string;
    capacity: number;
    node1_policy: NodePolicy;
    node2_policy: NodePolicy;
}

export interface LdkRouteHop {
    pubkey: string;
    short_channel_id: string;
    fee_msat: number;
    cltv_expiry_delta: number;
}

export interface LdkChannelInfo {
    channel_id: string;
    channel_value_satoshis: number;
    confirmations_required: number;
    counterparty_node_id: string;
    counterparty_unspendable_punishment_reserve: number;
    force_close_spend_delay: number;
    funding_txo_index: number;
    funding_txo_txid: string;
    inbound_capacity_msat: number;
    is_outbound: boolean;
    is_public: boolean;
    is_usable: boolean;
    outbound_capacity_msat: number;
    remote_node_id: string;
    short_channel_id: string;
    unspendable_punishment_reserve: number;
    user_id: number;
}