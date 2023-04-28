import type { BitcoinFeeEstimates, BitcoinTransaction, BitcoinTransactionMerkleProof, ChanInfo, DecodedInvoice, ExternalService, RouteQueryResponse } from "./interfaces";

const mainnetApiUrl = "https://blockstream.info/api";
const testnetApiUrl = "https://blockstream.info/testnet/api";
const wattageApiUrl = "https://wallet.wattage.app";

export class BlockstreamApi implements ExternalService {
    testnet: boolean;
    _apiUrl: string;

    constructor({ testnet }: { testnet: boolean }) {
        this.testnet = testnet;
        this._apiUrl = testnet ? testnetApiUrl : mainnetApiUrl;
    }

    async scriptToAddress(script: string): Promise<string> {
        const network = this.testnet ? "testnet" : "mainnet";
        const res = await fetch(`${wattageApiUrl}/script-to-address/${network}/${script}`);
        
        return await res.text();
    }
    async decodeInvoice(invoice: string): Promise<DecodedInvoice> {
        const res = await fetch(`${wattageApiUrl}/decode-invoice`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ invoice }),
        });
        
        return await res.json(); 
    }

    async queryRoutes(pubkey: string, amtMsat: number): Promise<RouteQueryResponse> {
        const res = await fetch(`${wattageApiUrl}/query-routes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                dest_pubkey: pubkey, 
                amt_msat: amtMsat,
            }),
        });

        return res.json();
    }
    async getChannelInfo(channelId: string): Promise<ChanInfo> {
        const res = await fetch(`${wattageApiUrl}/channel-info/${channelId}`);
        return await res.json();
    }

    _getJson(path: string): Promise<any> {
        return fetch(`${this._apiUrl}/${path}`).then((res) => res.json());
    }

    _getText(path: string): Promise<string> {
        return fetch(`${this._apiUrl}/${path}`).then((res) => res.text());
    }


    getAddressTransactions(address: string): Promise<BitcoinTransaction[]> {
        return this._getJson(`address/${address}/txs`)
    }

    getTransaction(txid: string): Promise<BitcoinTransaction> {
        return this._getJson(`tx/${txid}`)
    }
    getTransactionHex(txid: string): Promise<string> {
        return this._getText(`tx/${txid}/hex`)
    }

    getTransactionMerkleProof(txid: string): Promise<BitcoinTransactionMerkleProof> {
        return this._getJson(`tx/${txid}/merkle-proof`)
    }
    broadcastTransaction(txHex: string): Promise<string> {
        return fetch(`${this._apiUrl}/tx`, {
            method: "POST",
            body: txHex
        }).then((res) => res.text());

    }
    getBlockHash(height: number): Promise<string> {
        return this._getText(`block-height/${height}`)
    }
    getBlockHeader(hash: string): Promise<any> {
        return this._getText(`block/${hash}/header`)
    }
    getTipHeight(): Promise<number> {
        return this._getText(`blocks/tip/height`).then((res) => parseInt(res, 10))
    }
    async getFeeEstimates(): Promise<BitcoinFeeEstimates> {
        const response = await this._getJson(`fee-estimates`);
        const fast = response["2"];
        const medium = response["6"];
        const slow = response["144"];
        
        const processEstimate = (estimate: number) => {
            return Math.max(estimate, 1.01); // slighting increase the fee to avoid relay fee errors
        };

        return { 
            fast: processEstimate(fast),
            medium: processEstimate(medium),
            slow: processEstimate(slow)
         };
    }

}