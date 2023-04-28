import type { ChanInfo, ExternalService, LdkChannelInfo, LdkRouteHop } from "./interfaces";

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
    amtMsat: number;
    externalService: ExternalService;
    outboundChannel: LdkChannelInfo;
    constructor(service: ExternalService, destination_pubkey: string, amtSat: number, outboundChannel: LdkChannelInfo) {
        this.destination_pubkey = destination_pubkey;
        this.amtMsat = amtSat;
        this.outboundChannel = outboundChannel;
        this.externalService = service;
    }

    _feeForHop(info: ChanInfo, hopDestinationPubKey: string, amtToForwardMsat: number): number {
        const nodePolicy = info.node1_pub === hopDestinationPubKey ? info.node1_policy : info.node2_policy;
        const { 
            fee_base_msat: feeBase, 
            fee_rate_milli_msat: feeRate,
        } = nodePolicy;
        const fee = feeBase + (amtToForwardMsat * feeRate / 1000000);

        return Math.floor(fee);
    }

    async generate(): Promise<PaymentRoute> {
        const { routes } = await this.externalService.queryRoutes(this.destination_pubkey, this.amtMsat);
        if (routes.length === 0) {
            throw new Error("No routes found");
        }
        const allChanInfo: ChanInfo[] = [];
        const firstChanInfo = await this.externalService.getChannelInfo(routes[0].hops[0].chan_id);
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
                const info = await this.externalService.getChannelInfo(hop.chan_id);
                allChanInfo.push(info);
            }
        }
        for (const route of routes) {
            for (const hop of route.hops) {
                const info = allChanInfo.find(info => info.channel_id === hop.chan_id);
                const channelPolicy = info!.node1_pub === hop.pub_key ? info!.node1_policy : info!.node2_policy;
                const ldk_route: LdkRouteHop = {
                    pubkey: hop.pub_key,
                    short_channel_id: info!.channel_id.toString(),
                    fee_msat: this._feeForHop(info!, hop.pub_key, hop.amt_to_forward_msat),
                    cltv_expiry_delta: channelPolicy.time_lock_delta,
                };
                ldk_routes.push(ldk_route);
            }
        }
        // Set the last hop's fee to the amount we're sending
        ldk_routes[ldk_routes.length - 1].fee_msat = this.amtMsat;

        // Set the first hop's fee to the fee for the first channel
        ldk_routes[0].fee_msat = this._feeForHop(firstChanInfo, ldk_routes[0].pubkey, this.amtMsat);

        const result = {
            destination_pubkey: this.destination_pubkey,
            short_channel_id: this.outboundChannel.short_channel_id,
            payment_value_msat: this.amtMsat,
            ldk_routes
        }

        console.log(result);

        return result;
    }
}