import { PaymentRouteGenerator } from "../routes"

const usableChannel = {
    "channel_id": "5d27bcc75ddd08d29881cc046a83713429c435350cfe2325936ed01cbc2e37ca", 
    "channel_value_satoshis": 100000, 
    "confirmations_required": 3, 
    "counterparty_node_id": 
    "0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0", 
    "counterparty_unspendable_punishment_reserve": 1000, 
    "force_close_spend_delay": 144, 
    "funding_txo_index": 0, 
    "funding_txo_txid": "5d27bcc75ddd08d29881cc046a83713429c435350cfe2325936ed01cbc2e37ca", 
    "inbound_capacity_msat": 0, 
    "is_outbound": true, 
    "is_public": false, 
    "is_usable": true, 
    "outbound_capacity_msat": 99000000, 
    "remote_node_id": "0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0", 
    "short_channel_id": "2671331669406711808", 
    "unspendable_punishment_reserve": 1000, 
    "user_id": 42,
}

const stubRoutes = {
    "routes": [
        {
            "total_time_lock": 2430150,
            "total_fees": "0",
            "total_amt": "1000",
            "hops": [
                {
                    "chan_id": "2671350361104449536",
                    "chan_capacity": "500000",
                    "amt_to_forward": "1000",
                    "fee": "0",
                    "expiry": 2430150,
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

describe('Routes', () => {
    let routeGenerator: PaymentRouteGenerator

    beforeEach(() => {
        routeGenerator = new PaymentRouteGenerator("0367821c5f1db322146cb1174f68861c02d768664442d3c34febb63ac17312216b", 1000, usableChannel)
    })

    it('should generate a route', async () => {
        const res = await routeGenerator.generate()
        console.log(res)
    })
})