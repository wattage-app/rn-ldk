import type { ChanInfo, ExternalService, LdkChannelInfo, LdkRouteHop, PaymentRoute } from "./interfaces";

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
        let ldk_routes: LdkRouteHop[] = [];
        const firstChanInfo = await this.externalService.getChannelInfo(this.outboundChannel.channel_id);
        const firstHopPolicy = firstChanInfo.node1_pub === this.outboundChannel.counterparty_node_id ? firstChanInfo.node1_policy : firstChanInfo.node2_policy;

        if (this.outboundChannel.counterparty_node_id === this.destination_pubkey) {
            // Single hop to neighbor node
            ldk_routes = [
                {
                    pubkey: this.outboundChannel.counterparty_node_id,
                    short_channel_id: this.outboundChannel.short_channel_id,
                    fee_msat: this.amtMsat, // Full amount, no fee to neighbor
                    cltv_expiry_delta: firstHopPolicy.time_lock_delta
                },
            ];
        } else {
            const { routes } = await this.externalService.queryRoutes(this.destination_pubkey, this.amtMsat);
            if (routes.length === 0) {
                throw new Error("No routes found");
            }

            ldk_routes = [
                {
                    pubkey: this.outboundChannel.counterparty_node_id,
                    short_channel_id: this.outboundChannel.short_channel_id,
                    fee_msat: this._feeForHop(firstChanInfo, ldk_routes[0].pubkey, this.amtMsat),
                    cltv_expiry_delta: firstHopPolicy.time_lock_delta
                }
            ];

            for (const route of routes) {
                for (const hop of route.hops) {
                    const info = await this.externalService.getChannelInfo(hop.chan_id);
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
        }

        return {
            destination_pubkey: this.destination_pubkey,
            short_channel_id: this.outboundChannel.short_channel_id,
            payment_value_msat: this.amtMsat,
            ldk_routes
        };
    }
}