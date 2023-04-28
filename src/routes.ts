import type { ChanInfo, DecodedInvoice, ExternalService, LdkRouteHop } from "./interfaces";

export class PaymentRouteGenerator {
    externalService: ExternalService;
    outboundChannel: ChanInfo;
    ourNodeId: string;
    invoice: DecodedInvoice;

    constructor(service: ExternalService, ourNodeId: string, invoice: DecodedInvoice, outboundChannel: ChanInfo) {
        this.invoice = invoice;
        this.outboundChannel = outboundChannel;
        this.externalService = service;
        this.ourNodeId = ourNodeId;
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

    async generate(): Promise<LdkRouteHop[]> {
        let ldk_routes: LdkRouteHop[] = [];
        const destinationPubKey = this.invoice.payee_pubkey;
        const amtMsat = this.invoice.millisatoshis;
        const firstHopPolicy = this.outboundChannel.node1_pub === this.ourNodeId ? this.outboundChannel.node1_policy : this.outboundChannel.node2_policy;
        const outboundNeighborPubKey = this.outboundChannel.node1_pub === this.ourNodeId ? this.outboundChannel.node2_pub : this.outboundChannel.node1_pub;

        if (outboundNeighborPubKey === destinationPubKey) {
            // Single hop to neighbor node
            ldk_routes = [
                {
                    pubkey: outboundNeighborPubKey,
                    short_channel_id: this.outboundChannel.channel_id,
                    fee_msat: this.invoice.millisatoshis, // Full amount, no fee to neighbor
                    cltv_expiry_delta: firstHopPolicy.time_lock_delta
                },
            ];
        } else {
            const { routes } = await this.externalService.queryRoutes(destinationPubKey, this.invoice.millisatoshis);
            if (routes.length === 0) {
                throw new Error("No routes found");
            }

            ldk_routes = [
                {
                    pubkey: outboundNeighborPubKey,
                    short_channel_id: this.outboundChannel.channel_id,
                    fee_msat: this._feeForHop(this.outboundChannel, outboundNeighborPubKey, amtMsat),
                    cltv_expiry_delta: firstHopPolicy.time_lock_delta
                }
            ];

            for (const route of routes) {
                for (const hop of route.hops) {
                    // TODO: Get channel info for each hop asynchonously to speed this up.
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
            ldk_routes[ldk_routes.length - 1].fee_msat = amtMsat;
        }

        return ldk_routes;
    }
}