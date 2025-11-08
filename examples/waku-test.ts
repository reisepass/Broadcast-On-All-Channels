#!/usr/bin/env bun
/**
 * Waku Client-to-Client Test
 *
 * Waku is a decentralized communication protocol (from Status)
 * Uses content topics for message routing (similar to MQTT topics)
 * No built-in identity - we can use any keypair system
 * Messages can be ephemeral or stored via Store protocol
 */

import { createLightNode, waitForRemotePeer, createEncoder, createDecoder, Protocols } from '@waku/sdk';
import { contentTopicToPubsubTopic, pubsubTopicToSingleShardInfo } from '@waku/utils';
import { bytesToHex } from '@noble/hashes/utils';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

// Generate identity using secp256k1 (compatible with Nostr/XMTP)
function createWakuIdentity() {
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);
  return { privateKey: bytesToHex(privateKey), publicKey };
}

async function main() {
  console.log('💬 Waku Client-to-Client Test\n');

  // Create identities
  const identity1 = createWakuIdentity();
  const identity2 = createWakuIdentity();

  console.log('Client 1 Public Key:', identity1.publicKey);
  console.log('Client 2 Public Key:', identity2.publicKey);
  console.log('');

  try {
    // Content topic for direct messaging
    // Format: /app-name/version/content-topic/encoding
    const contentTopic1to2 = `/broadcast-test/1/dm-${identity2.publicKey}/proto`;
    const contentTopic2to1 = `/broadcast-test/1/dm-${identity1.publicKey}/proto`;

    console.log('📡 Starting Waku Light Node 1...');
    const node1 = await createLightNode({ defaultBootstrap: true });
    await node1.start();
    await node1.waitForPeers([Protocols.LightPush, Protocols.Filter]);
    console.log('✅ Node 1 started and connected to peers\n');

    console.log('📡 Starting Waku Light Node 2...');
    const node2 = await createLightNode({ defaultBootstrap: true });
    await node2.start();
    await node2.waitForPeers([Protocols.LightPush, Protocols.Filter]);
    console.log('✅ Node 2 started and connected to peers\n');

    // Create routing info for content topics
    // Using cluster 1 and 8 shards (default for Waku network)
    const pubsubTopic1to2 = contentTopicToPubsubTopic(contentTopic1to2, 1, 8);
    const shardInfo1to2 = pubsubTopicToSingleShardInfo(pubsubTopic1to2);
    const routingInfo1to2 = {
      ...shardInfo1to2,
      pubsubTopic: pubsubTopic1to2
    };

    const pubsubTopic2to1 = contentTopicToPubsubTopic(contentTopic2to1, 1, 8);
    const shardInfo2to1 = pubsubTopicToSingleShardInfo(pubsubTopic2to1);
    const routingInfo2to1 = {
      ...shardInfo2to1,
      pubsubTopic: pubsubTopic2to1
    };

    // Create encoders/decoders using standalone functions
    const encoder1to2 = createEncoder({ contentTopic: contentTopic1to2, routingInfo: routingInfo1to2 });
    const decoder2 = createDecoder(contentTopic1to2, routingInfo1to2);
    const encoder2to1 = createEncoder({ contentTopic: contentTopic2to1, routingInfo: routingInfo2to1 });
    const decoder1 = createDecoder(contentTopic2to1, routingInfo2to1);

    // Node 2 subscribes to messages for itself
    console.log('👂 Node 2 subscribing to content topic...');

    const messages2: string[] = [];

    await node2.filter.subscribe([decoder2], (wakuMessage) => {
      if (wakuMessage.payload) {
        const text = new TextDecoder().decode(wakuMessage.payload);
        console.log('📬 Node 2 received message:', text);
        messages2.push(text);
      }
    });
    console.log('✅ Node 2 subscribed\n');

    // Wait a bit for subscription to be fully established
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Node 1 sends message to Node 2
    console.log('📤 Node 1 sending message to Node 2...');
    const messageText1 = `Hello from Node 1 (${identity1.publicKey.slice(0, 8)}...)! Testing Waku protocol.`;
    const payload1 = new TextEncoder().encode(messageText1);

    const result1 = await node1.lightPush.send(encoder1to2, { payload: payload1 });
    console.log('✅ Message sent. Peers reached:', result1.successes.length);
    console.log('');

    // Wait for message delivery
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Node 1 subscribes to responses
    console.log('👂 Node 1 subscribing for responses...');
    const messages1: string[] = [];

    await node1.filter.subscribe([decoder1], (wakuMessage) => {
      if (wakuMessage.payload) {
        const text = new TextDecoder().decode(wakuMessage.payload);
        console.log('📬 Node 1 received message:', text);
        messages1.push(text);
      }
    });
    console.log('✅ Node 1 subscribed\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Node 2 sends response
    console.log('📤 Node 2 sending response to Node 1...');
    const messageText2 = `Hello from Node 2 (${identity2.publicKey.slice(0, 8)}...)! Got your message on Waku!`;
    const payload2 = new TextEncoder().encode(messageText2);

    const result2 = await node2.lightPush.send(encoder2to1, { payload: payload2 });
    console.log('✅ Response sent. Peers reached:', result2.successes.length);
    console.log('');

    // Wait for response delivery
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Summary
    console.log('📊 Message Summary:');
    console.log(`  Node 1 received ${messages1.length} message(s)`);
    console.log(`  Node 2 received ${messages2.length} message(s)`);
    console.log('');

    // Cleanup
    await node1.stop();
    await node2.stop();

    // Check results
    if (messages1.length > 0 && messages2.length > 0) {
      console.log('✅ Waku test completed successfully! Messages were delivered.\n');
    } else {
      console.log('⚠️  Waku test completed with NO message delivery.');
      console.log('   This is expected for local-only light nodes without relay peers.');
      console.log('   In production with the real Waku network, messages will be delivered.\n');

      // This is expected behavior - fail the test to alert the user
      throw new Error('❌ Test failed: Messages were not received (expected for local-only nodes)');
    }
    console.log('Key Properties:');
    console.log('  - Identity: No built-in identity (use any keypair)');
    console.log('  - Encryption: Not built-in (add your own)');
    console.log('  - Addressing: Content topics (like MQTT)');
    console.log('  - Format: /app-name/version/topic/encoding');
    console.log('  - Network: Decentralized P2P with relay nodes');
    console.log('  - Protocols: LightPush (send), Filter (receive), Store (history)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
main().catch(console.error);
