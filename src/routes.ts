import type { ChanInfo, LdkChannelInfo, LdkRouteHop, RouteHop, RouteQuery } from "./interfaces";

const stubRoutes = {
    "routes": [
        {
            "total_time_lock": 2430454,
            "total_fees": "0",
            "total_amt": "1000",
            "hops": [
                {
                    "chan_id": "2671350361104449536",
                    "chan_capacity": "500000",
                    "amt_to_forward": "1000",
                    "fee": "0",
                    "expiry": 2430454,
                    "amt_to_forward_msat": "1000000",
                    "fee_msat": "0",
                    "pub_key": "0367821c5f1db322146cb1174f68861c02d768664442d3c34febb63ac17312216b",
                    "tlv_payload": true,
                    "mpp_record": null,
                    "amp_record": null,
                    "custom_records": {
                    },
                    "metadata": null
                }
            ],
            "total_fees_msat": "0",
            "total_amt_msat": "1000000"
        }
    ],
    "success_prob": 0.95
}

const stubChanInfo = [
    {
        "channel_id": "2671331669406711808",
        "chan_point": "5d27bcc75ddd08d29881cc046a83713429c435350cfe2325936ed01cbc2e37ca:0",
        "last_update": 1682021534,
        "node1_pub": "0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0",
        "node2_pub": "0259b17e49fd2ceb2435f93d1231e49600c682820857b44a2b6abae9c2a7dd9685",
        "capacity": "100000",
        "node1_policy": {
            "time_lock_delta": 40,
            "min_htlc": "1000",
            "fee_base_msat": "1000",
            "fee_rate_milli_msat": "1",
            "disabled": false,
            "max_htlc_msat": "10000000",
            "last_update": 1681922666
        },
        "node2_policy": {
            "time_lock_delta": 72,
            "min_htlc": "1",
            "fee_base_msat": "1000",
            "fee_rate_milli_msat": "0",
            "disabled": false,
            "max_htlc_msat": "90000000",
            "last_update": 1682021534
        }
    },
    {
        "channel_id": "2671350361104449536",
        "chan_point": "7f5597f44f144f45a28c56a6a2f235f850de9787f18823e37eac580604671e8c:0",
        "last_update": 1682011849,
        "node1_pub": "0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0",
        "node2_pub": "0367821c5f1db322146cb1174f68861c02d768664442d3c34febb63ac17312216b",
        "capacity": "500000",
        "node1_policy": {
            "time_lock_delta": 40,
            "min_htlc": "1000",
            "fee_base_msat": "1000",
            "fee_rate_milli_msat": "1",
            "disabled": false,
            "max_htlc_msat": "495000000",
            "last_update": 1682011849
        },
        "node2_policy": {
            "time_lock_delta": 40,
            "min_htlc": "1000",
            "fee_base_msat": "1000",
            "fee_rate_milli_msat": "1",
            "disabled": false,
            "max_htlc_msat": "495000000",
            "last_update": 1682011849
        }
    }
]

export interface DecodedInvoiceTags {
    payment_hash: string;
    payment_secret: string;
    min_final_cltv_expiry: number;
}

export interface PaymentRoute {
    destination_pubkey: string;
    short_channel_id: string;
    payment_value_msat: number;
    ldk_routes: LdkRouteHop[];
}

export class PaymentRouteGenerator {
    destination_pubkey: string;
    amtSat: number;
    baseUrl: string = 'https://wattage.app';
    outboundChannel: LdkChannelInfo;
    constructor(destination_pubkey: string, amtSat: number, outboundChannel: LdkChannelInfo) {
        this.destination_pubkey = destination_pubkey;
        this.amtSat = amtSat;
        this.outboundChannel = outboundChannel;
    }

    async _getJson(path: string): Promise<any> {
        const res = await fetch(`${this.baseUrl}${path}`);

        return await res.json();
    }

    async _postJson(path: string, body: any): Promise<any> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        return await res.json();
    }

    async _getRoutes(): Promise<RouteQuery[]> {
        // const res = await this._postJson(`/wallet/routes/${this.destination_pubkey}`, {
        //     amtSat: this.amtSat
        // });
        return stubRoutes.routes;
    }

    async _getChanInfo(chanId: string): Promise<ChanInfo> {
        // const res = await this._getJson(`/wallet/chaninfo/${chanId}`);
        // return res;
        const found = stubChanInfo.find((chanInfo) => chanInfo.channel_id === chanId);
        if (!found) {
            throw new Error(`Channel not found: ${chanId}`);
        }

        return found;
    }

    async _decodeInvoice(paymentInvoice: string): Promise<DecodedInvoiceTags> {
        const res = await this._postJson(`/wallet/decodeinvoice`, {
            paymentInvoice
        });
        return res;
    }

    _feeForHop(info: ChanInfo, hopDestinationPubKey: string, amtToForwardMsat: number): number {
        const nodePolicy = info.node1_pub === hopDestinationPubKey ? info.node1_policy : info.node2_policy;
        const feeBase = parseInt(nodePolicy.fee_base_msat, 10);
        const feeRate = parseInt(nodePolicy.fee_rate_milli_msat, 10);
        const fee = feeBase + (amtToForwardMsat * feeRate / 1000000);

        return Math.floor(fee);
    }

    async generate(): Promise<PaymentRoute> {
        const routes = await this._getRoutes();
        const allChanInfo: ChanInfo[] = [];
        const firstChanInfo = await this._getChanInfo(this.outboundChannel.short_channel_id);
        const firstHopPolicy = firstChanInfo.node1_pub === this.outboundChannel.counterparty_node_id ? firstChanInfo.node1_policy : firstChanInfo.node2_policy;
        const ldk_routes: LdkRouteHop[] = [
            {
                pubkey: this.outboundChannel.counterparty_node_id,
                short_channel_id: this.outboundChannel.short_channel_id,
                fee_msat: 0,
                cltv_expiry_delta: firstHopPolicy.time_lock_delta
            }
        ];

        for (const route of routes) {
            for (const hop of route.hops) {
                const info = await this._getChanInfo(hop.chan_id)
                allChanInfo.push(info);
            }
        }
        let hopIdx = 0;
        for (const route of routes) {
            for (const hop of route.hops) {
                const info = allChanInfo.find(info => info.channel_id === hop.chan_id);
                const channelPolicy = info!.node1_pub === hop.pub_key ? info!.node1_policy : info!.node2_policy;
                const ldk_route: LdkRouteHop = {
                    pubkey: hop.pub_key,
                    short_channel_id: info!.channel_id,
                    fee_msat: this._feeForHop(info!, hop.pub_key, parseInt(hop.amt_to_forward_msat, 10)),
                    cltv_expiry_delta: channelPolicy.time_lock_delta,
                };
                ldk_routes.push(ldk_route);
                hopIdx++;
            }
        }
        // Set the last hop's fee to the amount we're sending
        ldk_routes[ldk_routes.length - 1].fee_msat = this.amtSat * 1000;

        // Set the first hop's fee to the fee for the first channel
        // ldk_routes[0].cltv_expiry_delta = firstChanInfo.time_lock_delta;
        ldk_routes[0].fee_msat = this._feeForHop(firstChanInfo, ldk_routes[0].pubkey, this.amtSat * 1000);

        // lntb10u1pjyxz33pp568t3kwltly07am070u6pt32a2rekv36xm2vsedcq95klpf67rw7sdqdw3jhxapqd3jxkcqzpgxq97zvuqsp5rck79rrr5d66gkyj6h7z3427mesmw0mz4nctnn29kggl5kjy8mvs9qyyssqahhx2yq2d777lm795yfwlu4fga0hc0xvpm5aq29j7nktrvtk89ty665pm4ljvm6l6kkvuxny25uj2hjh8uwdj80t29d86yqvdk9c9gsqarqlpl
        const result = {
            destination_pubkey: this.destination_pubkey,
            short_channel_id: this.outboundChannel.short_channel_id,
            payment_value_msat: this.amtSat * 1000,
            ldk_routes
        }

        console.log(result);

        return result;
    }
}