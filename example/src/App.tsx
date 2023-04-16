/* eslint-disable no-alert */
import * as React from 'react';
import { TextInput, Alert, StyleSheet, Text, Button, ScrollView } from 'react-native';
import RnLdk from 'rn-ldk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SyncedAsyncStorage from './synced-async-storage';

const RNFS = require('react-native-fs');

export default function App() {
  const [result, setResult] = React.useState<number | undefined>();
  const [text, onChangeText] = React.useState<string>('heres some text');

  React.useEffect(() => {
    RnLdk.getVersion().then(setResult);
  }, []);

  return (
    <ScrollView automaticallyAdjustContentInsets contentInsetAdjustmentBehavior={'automatic'} contentContainerStyle={styles.container}>
      <Text>
        ver {result} (package {RnLdk.getPackageVersion()})
      </Text>

      <Button
        onPress={async () => {
          console.warn('starting...');
          const entropy = '5d547853a7226aa54c5b7bc0f3888b4f7ca1a43b944b2946e9ea39085da1ef97';

          await RnLdk.selftest();
          console.warn('selftest passed');
          RnLdk.setStorage(AsyncStorage);
          RnLdk.setRefundAddressScript('00144220265aa0b2af9d572c65720e21c917d60fbd28'); // 13HaCAB4jf7FYSZexJxoczyDDnutzZigjS
          await RnLdk.start(entropy, RNFS.DocumentDirectoryPath).then(console.warn);
        }}
        title="Start"
        color="#841584"
      />

      <Button
        onPress={async () => {
          console.warn('stopping...');
          await RnLdk.stop();
        }}
        title="Stop"
        color="#841584"
      />

      <Button
        onPress={async () => {
          // wattage testnet node
          // 0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0@67.207.84.172:9735
          await RnLdk.connectPeer('0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0', '67.207.84.172', 9735).then(console.warn); // bitrefill
        }}
        title="connect peer"
        color="#841584"
      />

      <Button
        onPress={() => {
          RnLdk.listPeers().then(console.warn);
        }}
        title="listPeers"
        color="#841584"
      />

      <Button
        onPress={() => {
          RnLdk.checkBlockchain().then(console.warn);
        }}
        title="checkBlockchain (do this periodically)"
        color="#841584"
      />

      <Button
        onPress={() => {
          RnLdk.fireAnEvent();
        }}
        title="debug: fireAnEvent"
        color="#841584"
      />

      <Button
        onPress={async () => {
          const address = await RnLdk.openChannelStep1('0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0', 100000).catch(console.warn);
          console.log(address + '');
          onChangeText(address + '');
        }}
        title="openChannelStep1"
        color="#841584"
      />

      <TextInput editable onChangeText={onChangeText} value={text} multiline maxLength={65535} />

      <Button
        onPress={() => {
          if (!text) return;
          RnLdk.openChannelStep2(text, '0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0').then(console.warn);
        }}
        title="openChannelStep2"
        color="#841584"
      />

      <Button
        onPress={() => {
          RnLdk.listUsableChannels().then(console.warn);
        }}
        title="listUsableChannels"
        color="#841584"
      />

      <Button
        onPress={() => {
          RnLdk.listChannels().then(console.warn);
        }}
        title="listChannels"
        color="#841584"
      />

      <Button
        onPress={() => {
          RnLdk.getMaturingBalance().then((maturingBalance) => {
            console.warn({ maturingBalance });
          });
          RnLdk.getMaturingHeight().then((maturingHeight) => {
            console.warn({ maturingHeight });
          });
        }}
        title="get Maturing Balance/Height"
        color="#841584"
      />

      <Button
        onPress={async () => {
          if (!text) return Alert.alert('no channel id provided');
          await RnLdk.closeChannelCooperatively(text, '0252bdd5db4729bab7266eeb7252354c8b08cc8e89cc489dd765b6fec8d448d6a0');
        }}
        title="closeChannelCooperatively"
        color="#841584"
      />

      <Button
        onPress={async () => {
          if (!text) return Alert.alert('no invoice provided');
          const resultPayment = await RnLdk.sendPayment(text);
          Alert.alert(resultPayment + '');
        }}
        title="send payment"
        color="#841584"
      />

      <Button
        onPress={async () => {
          const nodeId = await RnLdk.getNodeId();
          Alert.alert(nodeId);
        }}
        title="get node id"
        color="#841584"
      />

      <Button
        onPress={async () => {
          const bolt11 = await RnLdk.addInvoice(2000000, 'Hello LDK');
          console.warn(bolt11);
        }}
        title="add invoice"
        color="#841584"
      />

      <Button
        onPress={async () => {
          try {
            const entropy = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            const syncedStorage = new SyncedAsyncStorage(entropy);
            await syncedStorage.selftest();
            // that should also work when RnLdk is started: `await RnLdk.getStorage().selftest();`

            await RnLdk.selftest();
            // @ts-ignore
            alert('ok');
          } catch (error) {
            // @ts-ignore
            alert(error.message);
          }
        }}
        title="self test"
        color="#841584"
      />

      <Button
        onPress={async () => {
          await AsyncStorage.clear();
          Alert.alert('purged');
        }}
        title="PURGE async storage"
        color="#841584"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
