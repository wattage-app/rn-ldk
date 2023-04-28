import { NativeEventEmitter, NativeModules, Alert } from 'react-native';
import type { BitcoinTransaction, BitcoinTransactionMerkleProof, DecodedInvoice, ExternalService, LdkChannelInfo } from './interfaces';
import { BlockstreamApi } from './blockstream';
import { PaymentRouteGenerator } from './routes';
const { RnLdk: RnLdkNative } = NativeModules;
const pckg = require('../package.json');

const MARKER_LOG = 'log';
interface LogMsg {
  ts: string;
  line: string;
}

const MARKER_REGISTER_OUTPUT = 'marker_register_output';
interface RegisterOutputMsg {
  block_hash: string;
  index: string;
  script_pubkey: string;
}

const MARKER_REGISTER_TX = 'register_tx';
interface RegisterTxMsg {
  txid: string;
  script_pubkey: string;
}

const MARKER_BROADCAST = 'broadcast';
interface BroadcastMsg {
  txhex: string;
}

const MARKER_PERSIST = 'persist';
interface PersistMsg {
  id: string;
  data: string;
}

const MARKER_PAYMENT_SENT = 'payment_sent';
interface PaymentSentMsg {
  payment_preimage: string;
}

const MARKER_PAYMENT_FAILED = 'payment_failed';
interface PaymentFailedMsg {
  rejected_by_dest: boolean;
  payment_hash: string;
}

const MARKER_PAYMENT_PATH_FAILED = 'payment_path_failed';
interface PaymentPathFailedMsg {
  rejected_by_dest: boolean;
  payment_hash: string;
}

const MARKER_PAYMENT_RECEIVED = 'payment_received';
interface PaymentReceivedMsg {
  payment_hash: string;
  payment_secret?: string;
  payment_preimage?: string;
  amt: string;
}

const MARKER_PERSIST_MANAGER = 'persist_manager';
interface PersistManagerMsg {
  channel_manager_bytes: string;
}

const MARKER_FUNDING_GENERATION_READY = 'funding_generation_ready';
interface FundingGenerationReadyMsg {
  channel_value_satoshis: string;
  output_script: string;
  temporary_channel_id: string;
  user_channel_id: string;
  counterparty_node_id: string;
}

type ClosureReason = 'ProcessingError' | 'OutdatedChannelManager' | 'HolderForceClosed' | 'DisconnectedPeer' | 'CounterpartyForceClosed' | 'CooperativeClosure' | 'CommitmentTxConfirmed';
const MARKER_CHANNEL_CLOSED = 'channel_closed';
interface ChannelClosedMsg {
  reason: ClosureReason;
  channel_id: string;
  user_channel_id: number;
  text?: string;
}

class RnLdkImplementation {
  static CHANNEL_MANAGER_PREFIX = 'channel_manager';
  static CHANNEL_PREFIX = 'channel_monitor_';

  private storage: any = false;
  private registeredOutputs: RegisterOutputMsg[] = [];
  private registeredTxs: RegisterTxMsg[] = [];
  private fundingsReady: FundingGenerationReadyMsg[] = [];

  sentPayments: PaymentSentMsg[] = [];
  receivedPayments: PaymentReceivedMsg[] = [];
  failedPayments: PaymentFailedMsg[] = [];
  failedPathPayments: PaymentPathFailedMsg[] = [];
  channelsClosed: ChannelClosedMsg[] = [];
  logs: LogMsg[] = [];

  private started = false;

  private externalService: ExternalService;

  constructor() {
    this.externalService = new BlockstreamApi({
      testnet: true,
    })
  }

  /**
   * Called by native code when LDK successfully sent payment.
   * Should not be called directly.
   *
   * @param event
   */
  _paymentSent(event: PaymentSentMsg) {
    // TODO: figure out what to do with it
    this.logToGeneralLog('payment sent:', event);
    this.sentPayments.push(event);
  }

  /**
   * Called by native code when LDK received payment
   * Should not be called directly.
   *
   * @param event
   */
  _paymentReceived(event: PaymentReceivedMsg) {
    // TODO: figure out what to do with it
    this.logToGeneralLog('payment received:', event);
    this.receivedPayments.push(event);
  }

  /**
   * Called by native code when LDK failed to send payment.
   * Should not be called directly.
   *
   * @param event
   */
  _paymentFailed(event: PaymentFailedMsg) {
    // TODO: figure out what to do with it
    console.warn('payment failed:', event);
    this.logToGeneralLog('payment failed:', event);
    this.failedPayments.push(event);
  }

  /**
   * Called by native code when LDK failed to send payment _to_a_path_.
   * Should not be called directly.
   *
   * @param event
   */
  _paymentPathFailed(event: PaymentPathFailedMsg) {
    // TODO: figure out what to do with it
    console.warn('payment path failed:', event);
    this.logToGeneralLog('payment path failed:', event);
    this.failedPathPayments.push(event);
  }

  /**
   * Caled by native code when LDK passes log message.
   * Should not be called directly.
   *
   * @param event
   */
  _log(event: LogMsg) {
    console.log('ldk log:', event);
    if (!event.ts) event.ts = new Date().toISOString().replace('T', ' ');
    this.logs.push(event);
  }

  logToGeneralLog(...args: any[]) {
    const str = JSON.stringify(args);
    console.log('js log:', str);
    const msg: LogMsg = {
      ts: new Date().toISOString().replace('T', ' '),
      line: str,
    };

    this.logs.push(msg);
  }

  /**
   * Called when native code sends us an output we should keep an eye on
   * and notify native code if there is some movement there.
   * Should not be called directly.
   *
   * @param event
   */
  _registerOutput(event: RegisterOutputMsg) {
    this.logToGeneralLog('registerOutput', event);
    this.registeredOutputs.push(event);
  }

  /**
   * Called when native code sends us a transaction we should keep an eye on
   * and notify native code if there is some movement there.
   * Should not be called directly.
   *
   * @param event
   */
  _registerTx(event: RegisterTxMsg) {
    event.txid = this.reverseTxid(event.txid); // achtung, little-endian
    this.logToGeneralLog('registerTx', event);
    this.registeredTxs.push(event);
  }

  _fundingGenerationReady(event: FundingGenerationReadyMsg) {
    this.logToGeneralLog('funding generation ready:', event);
    this.fundingsReady.push(event);
  }

  _channelClosed(event: ChannelClosedMsg) {
    this.logToGeneralLog('channel closed:', event);
    this.channelsClosed.push(event);
  }

  /**
   * Called when native code sends us channel-specific backup data bytes we should
   * save to persistent storage.
   * Should not be called directly.
   *
   * @param event
   */
  async _persist(event: PersistMsg) {
    return this.setItem(RnLdkImplementation.CHANNEL_PREFIX + event.id, event.data);
  }

  _persistManager(event: PersistManagerMsg) {
    return this.setItem(RnLdkImplementation.CHANNEL_MANAGER_PREFIX, event.channel_manager_bytes);
  }

  /**
   * Called when native code wants us to broadcast some transaction.
   * Should not be called directly.
   *
   * @param event
   */
  async _broadcast(event: BroadcastMsg) {
    this.logToGeneralLog('broadcasting', event);
    try {
      return await this.externalService.broadcastTransaction(event.txhex);
    } catch (e) {
      console.error(e);
      // @ts-ignore
      return e.message;
    }
  }

  private reverseTxid(hex: string): string {
    if (hex.length % 2 !== 0) throw new Error('incorrect hex ' + hex);
    const matched = hex.match(/[a-fA-F0-9]{2}/g);
    if (matched) {
      return matched.reverse().join('');
    }
    return '';
  }

  private async script2address(scriptHex: string): Promise<string> {
    return this.externalService.scriptToAddress(scriptHex);
  }

  /**
   * Fetches from network registered outputs, registered transactions and block tip
   * and feeds this into to native code, if necessary.
   * Should be called periodically.
   */
  async checkBlockchain(progressCallback?: (progress: number) => void) {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog('checkBlockchain() 1/x');
    if (progressCallback) progressCallback(1 / 8);
    await this.updateBestBlock();

    this.logToGeneralLog('checkBlockchain() 1.5/x');
    await this.saveNetworkGraph();
    if (progressCallback) progressCallback(1.5 / 8);

    this.logToGeneralLog('checkBlockchain() 2/x');
    if (progressCallback) progressCallback(2 / 8);
    await this.updateFeerate();

    const confirmedBlocks: any = {};

    // iterating all subscriptions for confirmed txid
    this.logToGeneralLog('checkBlockchain() 3/x');
    if (progressCallback) progressCallback(3 / 8);
    for (const regTx of this.registeredTxs) {
      let json: BitcoinTransaction | undefined;
      try {
        json = await this.externalService.getTransaction(regTx.txid);
      } catch (_) { }
      if (json && json.status && json.status.confirmed && json.status.block_height) {
        // success! tx confirmed, and we need to notify LDK about it

        let jsonPos: BitcoinTransactionMerkleProof | undefined;
        try {
          jsonPos = await this.externalService.getTransactionMerkleProof(regTx.txid);
        } catch (_) { }

        if (jsonPos && jsonPos.merkle) {
          confirmedBlocks[json.status.block_height + ''] = confirmedBlocks[json.status.block_height + ''] || {};
          const txHex = await this.externalService.getTransactionHex(regTx.txid);
          confirmedBlocks[json.status.block_height + ''][jsonPos.pos + ''] = txHex
        }
      }
    }

    // iterating all scripts for spends
    this.logToGeneralLog('checkBlockchain() 4/x');
    if (progressCallback) progressCallback(4 / 8);
    for (const regOut of this.registeredOutputs) {
      let txs: BitcoinTransaction[] = [];
      try {
        const address = await this.script2address(regOut.script_pubkey);
        txs = await this.externalService.getAddressTransactions(address);
      } catch (_) { }
      for (const tx of txs) {
        if (tx && tx.status && tx.status.confirmed && tx.status.block_height) {
          // got confirmed tx for that output!

          let jsonPos;
          try {
            jsonPos = await this.externalService.getTransactionMerkleProof(tx.txid);
          } catch (_) { }

          if (jsonPos && jsonPos.merkle) {
            const txHex = await this.externalService.getTransactionHex(tx.txid);
            confirmedBlocks[tx.status.block_height + ''] = confirmedBlocks[tx.status.block_height + ''] || {};
            confirmedBlocks[tx.status.block_height + ''][jsonPos.pos + ''] = txHex;
          }
        }
      }
    }

    // now, got all data packed in `confirmedBlocks[block_number][tx_position]`
    // lets feed it to LDK:

    this.logToGeneralLog('confirmedBlocks=', confirmedBlocks);

    this.logToGeneralLog('checkBlockchain() 5/x');
    if (progressCallback) progressCallback(5 / 8);
    for (const height of Object.keys(confirmedBlocks).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
      for (const pos of Object.keys(confirmedBlocks[height]).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
        await RnLdkNative.transactionConfirmed(await this.getHeaderHexByHeight(parseInt(height, 10)), parseInt(height, 10), parseInt(pos, 10), confirmedBlocks[height][pos]);
      }
    }

    this.logToGeneralLog('checkBlockchain() 6/x');
    if (progressCallback) progressCallback(6 / 8);
    let txidArr = [];
    try {
      const jsonString = await RnLdkNative.getRelevantTxids();
      this.logToGeneralLog('RnLdkNative.getRelevantTxids:', jsonString);
      txidArr = JSON.parse(jsonString);
    } catch (error: any) {
      this.logToGeneralLog('getRelevantTxids:', error.message);
      console.warn('getRelevantTxids:', error.message);
    }

    // we need to check if any of txidArr got unconfirmed, and then feed it back to LDK if they are unconf
    this.logToGeneralLog('checkBlockchain() 7/x');
    if (progressCallback) progressCallback(7 / 8);
    for (const txid of txidArr) {
      let confirmed = false;
      try {
        const tx: BitcoinTransactionMerkleProof = await this.externalService.getTransactionMerkleProof(txid);
        if (tx && tx.block_height) confirmed = true;
      } catch (_) {
        confirmed = false;
      }

      if (!confirmed) await RnLdkNative.transactionUnconfirmed(txid);
    }

    this.logToGeneralLog('checkBlockchain() done');
    if (progressCallback) progressCallback(8 / 8);

    return true;
  }

  /**
   * Starts the process of opening a channel
   * @param pubkey Remote noed pubkey
   * @param sat Channel value
   *
   * @returns string|false Either address to deposit sats to or false if smth went wrong
   */
  async openChannelStep1(pubkey: string, sat: number): Promise<string | false> {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog(`opening channel with ${pubkey} for ${sat} sat`);
    this.fundingsReady = []; // reset it
    const tempChannelId: string = await RnLdkNative.openChannelStep1(pubkey, sat);
    if (!tempChannelId) return false;
    let timer = 60;
    while (timer-- > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // sleep
      if (this.fundingsReady.length > 0) {
        const funding = this.fundingsReady.pop();
        if (funding) {
          return await this.script2address(funding.output_script);
        }
        break;
      }

      // what if our temp channel closed while we wait for the funding generation event? lets check it:
      for (const closed of this.channelsClosed) {
        if (42 === +closed.user_channel_id || closed.channel_id === tempChannelId) {
          this.logToGeneralLog('channel closed while waiting for FundingGenerationReady event');
          return false;
        }
      }
    }

    this.logToGeneralLog('timeout waiting for FundingGenerationReady event');
    return false;
  }

  /**
   * Finishes opening channel starter in `openChannelStep1()`. Once you created a transaction to address
   * generated by `openChannelStep1()` with the amount you specified, feed txhex to this method to
   * finalize opening a channel.
   *
   * @param txhex
   * @param counterpartyNodeIdHex
   *
   * @returns boolean Success or not
   */
  async openChannelStep2(txhex: string, counterpartyNodeIdHex: string) {
    if (!this.started) throw new Error('LDK not yet started');
    console.warn('submitting to ldk', { txhex, counterpartyNodeIdHex });
    this.logToGeneralLog('submitting to ldk', { txhex, counterpartyNodeIdHex });
    return RnLdkNative.openChannelStep2(txhex, counterpartyNodeIdHex);
  }

  async closeChannelCooperatively(channelIdHex: string, counterpartyNodeIdHex: string) {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog(`closing channel cooperatively, channel id: ${channelIdHex} ${counterpartyNodeIdHex}`);
    return RnLdkNative.closeChannelCooperatively(channelIdHex, counterpartyNodeIdHex);
  }

  async closeChannelForce(channelIdHex: string, counterpartyNodeIdHex: string) {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog(`force-closing channel, channel id: ${channelIdHex} ${counterpartyNodeIdHex}`);
    return RnLdkNative.closeChannelForce(channelIdHex);
  }

  /**
   * @returns node pubkey
   */
  async getNodeId(): Promise<string> {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog('getting node id');
    const nodeId = await RnLdkNative.getNodeId();
    this.logToGeneralLog('node id', nodeId);
    return nodeId;
  }

  /**
   * @returns Array<{}>
   */
  async listUsableChannels() {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog('listing usable channels');
    const str = await RnLdkNative.listUsableChannels();
    return JSON.parse(str);
  }

  /**
   * @returns Array<{}>
   */
  async listChannels() {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog('listing channels');
    const str = await RnLdkNative.listChannels();
    return JSON.parse(str);
  }

  async getMaturingBalance() {
    return RnLdkNative.getMaturingBalance();
  }

  async getMaturingHeight() {
    return RnLdkNative.getMaturingHeight();
  }

  private async getHeaderHexByHeight(height: number) {
    const hash = await this.externalService.getBlockHash(height);
    return this.externalService.getBlockHeader(hash);
  }

  private async getCurrentHeight() {
    return this.externalService.getTipHeight();
  }

  private async updateFeerate() {
    this.logToGeneralLog('updating feerate');
    try {
      const feeRates = await this.externalService.getFeeEstimates();
      await this.setFeerate(feeRates.fast, feeRates.medium, feeRates.slow);
    } catch (error) {
      console.warn('updateFeerate() failed:', error);
      this.logToGeneralLog('updateFeerate() failed:', error);
    }
  }

  private async updateBestBlock() {
    this.logToGeneralLog('updating best block');
    const height = await this.getCurrentHeight();
    const hash = await this.externalService.getBlockHash(height);
    const headerHex = await this.externalService.getBlockHeader(hash);
    console.log('updateBestBlock():', { headerHex, height });
    this.logToGeneralLog('updateBestBlock():', { headerHex, height });
    return RnLdkNative.updateBestBlock(headerHex, height);
  }

  getVersion(): Promise<number> {
    this.logToGeneralLog('getting version');
    return RnLdkNative.getVersion();
  }

  getPackageVersion(): string {
    return pckg.version;
  }

  /**
   * Spins up the node. Should be called before anything else.
   * Assumes storage is provided.
   *
   * @param entropyHex 256 bit entropy, basically a private key for a node, e.g. 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
   * @param writablePath A local fs dir that's writable and persists - network graph shall be stored there. If default value is used - then no graph sync will be attempted
   *
   * @returns boolean TRUE if all went well
   */
  async start(entropyHex: string, writablePath: string = ''): Promise<boolean> {
    if (!this.storage) throw new Error('Storage is not yet set');
    if (this.started) throw new Error('LDK already started');
    this.logToGeneralLog('LDK starting...');
    this.started = true;
    const keys4monitors = (await this.getAllKeys()).filter((key: string) => key.startsWith(RnLdkImplementation.CHANNEL_PREFIX));
    const monitorHexes = [];
    this.logToGeneralLog('keys4monitors=', keys4monitors);
    for (const key of keys4monitors) {
      const hex = await this.getItem(key);
      if (hex) monitorHexes.push(hex);
    }

    const blockchainTipHeight = await this.externalService.getTipHeight();
    const blockchainTipHashHex = await this.externalService.getBlockHash(blockchainTipHeight);

    const serializedChannelManagerHex = (await this.getItem(RnLdkImplementation.CHANNEL_MANAGER_PREFIX)) || '';
    this.logToGeneralLog('starting with', { blockchainTipHeight, blockchainTipHashHex, serializedChannelManagerHex, monitorHexes: monitorHexes.join(',') });
    return RnLdkNative.start(entropyHex, blockchainTipHeight, blockchainTipHashHex, serializedChannelManagerHex, monitorHexes.join(','), writablePath);
  }

  /**
   * In native code, purges in-memory network graph to file on disk
   */
  async saveNetworkGraph() {
    return RnLdkNative.saveNetworkGraph();
  }

  /**
   * Tries to pay an invoice using our internal pathfinding, given that we enabled
   * graph sync on startup
   *
   * @param bolt11 Invoice string
   * @param amtSat Amount in sats in case it's a zero-amount invoice
   */
  async payInvoice(bolt11: string, amtSat: number): Promise<boolean> {
    return RnLdkNative.payInvoice(bolt11, amtSat);
  }

  /**
   * Connects to other lightning node
   *
   * @param pubkeyHex Other node pubkey
   * @param hostname Other node ip
   * @param port Other node port
   *
   * @return boolean success or not
   */
  connectPeer(pubkeyHex: string, hostname: string, port: number): Promise<boolean> {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog(`connecting to peer ${pubkeyHex}@${hostname}:${port}`);
    return RnLdkNative.connectPeer(pubkeyHex, hostname, port);
  }

  disconnectByNodeId(pubkeyHex: string): Promise<boolean> {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog(`disconnecting peer ${pubkeyHex}`);
    return RnLdkNative.disconnectByNodeId(pubkeyHex);
  }

  /**
   * Returns list of other lightning nodes we are connected to
   *
   * @returns array
   */
  async listPeers(): Promise<string[]> {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog(`listing peers`);
    const jsonString = await RnLdkNative.listPeers();
    try {
      return JSON.parse(jsonString);
    } catch (error: any) {
      this.logToGeneralLog(error.message);
      console.warn(error.message);
    }

    return [];
  }

  /**
   * Asks native code to emit test log event, which is supposed to land in this.logs
   */
  fireAnEvent(): Promise<boolean> {
    return RnLdkNative.fireAnEvent();
  }

  /**
   * Prodives LKD current feerate to use with all onchain transactions (like sweeps after forse-closures)
   *
   * @param newFeerateFast {number} Sat/b
   * @param newFeerateMedium {number} Sat/b
   * @param newFeerateSlow {number} Sat/b
   */
  setFeerate(newFeerateFast: number, newFeerateMedium: number, newFeerateSlow: number): Promise<boolean> {
    this.logToGeneralLog('setting feerate', { newFeerateFast, newFeerateMedium, newFeerateSlow });
    return RnLdkNative.setFeerate(newFeerateFast * 250, newFeerateMedium * 250, newFeerateSlow * 250);
  }

  setRefundAddressScript(refundAddressScriptHex: string) {
    this.logToGeneralLog(`setting refund script hex to ${refundAddressScriptHex}`);
    return RnLdkNative.setRefundAddressScript(refundAddressScriptHex);
  }

  /**
   * Method to set storage that will handle persistance. Should conform to the spec
   * (have methods setItem, getItem & getAllKeys)
   *
   * @param storage object
   */
  setStorage(storage: any) {
    if (!storage.setItem || !storage.getItem || !storage.getAllKeys) throw new Error('Bad provided storage');
    this.storage = storage;
  }

  getStorage() {
    return this.storage;
  }

  /**
   * Wrapper for provided storage
   *
   * @param key
   * @param value
   */
  async setItem(key: string, value: string) {
    if (!this.storage) throw new Error('No storage');
    this.logToGeneralLog(`persisting ${key}`);
    console.log('::::::::::::::::: saving to disk', key, '=', value.substring(0, 100));
    return this.storage.setItem(key, value);
  }

  /**
   * Wrapper for provided storage
   *
   * @param key
   */
  async getItem(key: string) {
    if (!this.storage) throw new Error('No storage');
    this.logToGeneralLog(`reading from storage ${key}`);
    console.log('::::::::::::::::: reading from disk', key);
    const ret = await this.storage.getItem(key);
    console.log('::::::::::::::::: --------------->>', JSON.stringify(ret));
    return ret;
  }

  /**
   * Wrapper for provided storage
   *
   * @returns string[]
   */
  async getAllKeys() {
    if (!this.storage) throw new Error('No storage');
    return this.storage.getAllKeys();
  }

  async addInvoice(amtMsat: number, description: string = '') {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog(`adding invoice for ${amtMsat} msat, decription=${description}`);
    return RnLdkNative.addInvoice(amtMsat, description);
  }

  async stop() {
    this.logToGeneralLog(`stopping LDK`);
    await RnLdkNative.stop();
    this.started = false;
  }

  private async decodeInvoice(bolt11: string): Promise<DecodedInvoice> {
    return this.externalService.decodeInvoice(bolt11);
  }

  /**
   * Tries to pay an invoice using 3rd party server for routefinding
   *
   * @param bolt11 Invoice string
   * @param numSatoshis Amount in sats in case it's a zero-amount invoice
   */
  async sendPayment(bolt11: string): Promise<boolean> {
    if (!this.started) throw new Error('LDK not yet started');
    this.logToGeneralLog('sendPayment():', { bolt11 });
    await this.updateBestBlock();
    // fixme: this is a hack to get around the fact that force closed channels are not yet removed from the list
    let usableChannels: LdkChannelInfo[] = await this.listUsableChannels();
    const openChannel = await Promise.any(usableChannels.map(
      (channel) => this.externalService.getChannelInfo(channel.short_channel_id))
    );

    if (usableChannels.length === 0 || !openChannel) throw new Error('No usable channels');
    const usableChannel = usableChannels.find(channel => {
      return channel.short_channel_id === openChannel.channel_id.toString();
    });
    if (!usableChannel) throw new Error('No usable channels');

    const decoded = await this.decodeInvoice(bolt11);
    if (!decoded.millisatoshis) {
      console.warn("Cannot send payment: invoice doesn't have amount")
      return false;
    }

    let payment_hash = decoded.tags.payment_hash;
    let min_final_cltv_expiry = decoded.tags.min_final_cltv_expiry;
    let payment_secret = decoded.tags.payment_secret;

    if (!payment_hash) throw new Error('No payment_hash');
    if (!payment_secret) throw new Error('No payment_secret');

    const router = new PaymentRouteGenerator(this.externalService, decoded.payee_pubkey, decoded.millisatoshis, usableChannel);
    const route = await router.generate()

    return RnLdkNative.sendPayment(
      decoded.payee_pubkey,
      payment_hash,
      payment_secret,
      route.short_channel_id,
      route.payment_value_msat,
      min_final_cltv_expiry,
      JSON.stringify(route.ldk_routes, null, 2)
    );
  }

  static assertEquals(a: any, b: any) {
    if (a !== b) throw new Error('RnLdk: Assertion failed that ' + a + ' equals ' + b);
  }

  /**
   * self test function that is supposed to run in RN runtime to verify everything is set up correctly
   */
  async selftest(skipTestEvents = false): Promise<boolean> {
    const decoded = await this.decodeInvoice(
      'lnbc2220n1psvm6rhpp53pxqkcq4j9hxjy5vtsll0rhykqzyjch2gkvlfv5mfdsyul5rnk5sdqqcqzpgsp5qwfm205gklcnf5jqnvpdl22p48adr4hkpscxedrltr7yc29tfv7s9qyyssqeff7chcx08ndxl3he8vgmy7up3z8drd7j0xn758gwkjyfk6ncqesa4hj36r26q68jfpvj0555fr77hhvhtczhh0h9rahdhgtcpj2fpgplfsqg0'
    );
    RnLdkImplementation.assertEquals(decoded.millisatoshis, 222000);
    RnLdkImplementation.assertEquals(await this.script2address('0020ff3eee58d5a55baa44dc10862ebd50bc16e4aade5501a0339c5c20c64478dc0f'), 'bc1qlulwukx454d653xuzzrza02shstwf2k725q6qvuutssvv3rcms8sarxvad');
    RnLdkImplementation.assertEquals(await this.script2address('00143ada446d4196f67e4a83a9168dd751f9c69c2f94'), 'bc1q8tdygm2pjmm8uj5r4ytgm463l8rfctu5d50yyu');

    //
    if (skipTestEvents) return true;

    this.logs = [];
    await RnLdk.fireAnEvent();
    await new Promise((resolve) => setTimeout(resolve, 200)); // sleep
    if (!this.logs.find((el) => el.line === 'test')) throw new Error('Cant find test log event: ' + JSON.stringify(RnLdk.logs));

    return true;
  }

  getLogs() {
    return this.logs;
  }

  cleanLogs() {
    this.logs = [];
  }
}

const RnLdk = new RnLdkImplementation();

const eventEmitter = new NativeEventEmitter(NativeModules.ReactEventEmitter);

eventEmitter.addListener(MARKER_LOG, (event: LogMsg) => {
  RnLdk._log(event);
});

eventEmitter.addListener(MARKER_REGISTER_OUTPUT, (event: RegisterOutputMsg) => {
  RnLdk._registerOutput(event);
});

eventEmitter.addListener(MARKER_REGISTER_TX, (event: RegisterTxMsg) => {
  RnLdk._registerTx(event);
});

eventEmitter.addListener(MARKER_BROADCAST, (event: BroadcastMsg) => {
  RnLdk._broadcast(event).then(console.log);
});

const channelPersisterTimeouts: any = {};
eventEmitter.addListener(MARKER_PERSIST, async (event: PersistMsg) => {
  // dumb way to dedup bulk updates:
  if (channelPersisterTimeouts[event.id]) {
    console.log('deduping channel monitor persist events');
    clearTimeout(channelPersisterTimeouts[event.id]);
  }
  channelPersisterTimeouts[event.id] = setTimeout(async () => {
    channelPersisterTimeouts[event.id] = null;
    try {
      if (!event.id || !event.data) throw new Error('Unexpected data passed for persister: ' + JSON.stringify(event));
      await RnLdk._persist(event);
    } catch (error: any) {
      console.error(error.message);
      Alert.alert('persister: ' + error.message);
    }
  }, 1000);
});

let managerPersisterTimeout: NodeJS.Timeout | null;
eventEmitter.addListener(MARKER_PERSIST_MANAGER, async (event: PersistManagerMsg) => {
  // dumb way to dedup bulk updates:
  if (managerPersisterTimeout) {
    console.log('deduping channel manager persist events');
    clearTimeout(managerPersisterTimeout);
  }
  managerPersisterTimeout = setTimeout(async () => {
    managerPersisterTimeout = null;
    try {
      if (!event.channel_manager_bytes) throw new Error('Unexpected data passed for manager persister: ' + JSON.stringify(event));
      await RnLdk._persistManager(event);
    } catch (error: any) {
      console.error(error.message);
      Alert.alert('manager persister: ' + error.message);
    }
  }, 1000);
});

eventEmitter.addListener(MARKER_PAYMENT_FAILED, (event: PaymentFailedMsg) => {
  RnLdk._paymentFailed(event);
});

eventEmitter.addListener(MARKER_PAYMENT_PATH_FAILED, (event: PaymentPathFailedMsg) => {
  RnLdk._paymentPathFailed(event);
});

eventEmitter.addListener(MARKER_PAYMENT_RECEIVED, (event: PaymentReceivedMsg) => {
  RnLdk._paymentReceived(event);
});

eventEmitter.addListener(MARKER_PAYMENT_SENT, (event: PaymentSentMsg) => {
  RnLdk._paymentSent(event);
});

eventEmitter.addListener(MARKER_FUNDING_GENERATION_READY, (event: FundingGenerationReadyMsg) => {
  RnLdk._fundingGenerationReady(event);
});

eventEmitter.addListener(MARKER_CHANNEL_CLOSED, (event: ChannelClosedMsg) => {
  console.log('channel closed event', { event });
  RnLdk._channelClosed(event);
});

export default RnLdk as RnLdkImplementation;
