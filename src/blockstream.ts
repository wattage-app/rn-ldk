import type { BitcoinFeeEstimates, BitcoinTransaction, BitcoinTransactionMerkleProof, ExternalService } from "./interfaces";

const mainnetApiUrl = "https://blockstream.info/api";
const testnetApiUrl = "https://blockstream.info/testnet/api";

export class BlockstreamApi implements ExternalService {
    _apiUrl: string;

    constructor({ testnet }: { testnet: boolean }) {
        this._apiUrl = testnet ? testnetApiUrl : mainnetApiUrl;
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
            estimate = Math.round(estimate);
            return Math.max(estimate, 2);
        };

        return { 
            fast: processEstimate(fast),
            medium: processEstimate(medium),
            slow: processEstimate(slow)
         };
    }

}