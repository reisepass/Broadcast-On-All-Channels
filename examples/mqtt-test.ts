#!/usr/bin/env bun
/**
 * MQTT Client-to-Client Test
 *
 * MQTT has no built-in identity system - we create our own
 * Messages are sent to topics (pub/sub pattern)
 * For direct messaging, we use topics based on recipient's public key
 * Using Flespi broker which supports message retention
 */

import mqtt from 'mqtt';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';

// MQTT Brokers with persistence/retention
const BROKERS = {
  flespi: 'mqtt://mqtt.flespi.io:1883', // Has message retention
  hivemq: 'mqtt://broker.hivemq.com:1883', // Public, less reliable retention
  emqx: 'mqtt://broker.emqx.io:1883', // Public broker
};

// Generate identity using secp256k1 (compatible with Nostr/XMTP)
function createMqttIdentity() {
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);
  return { privateKey: bytesToHex(privateKey), publicKey };
}

function createClient(brokerUrl: string, clientId: string): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, {
      clientId,
      clean: false, // Maintain session for offline messages
      reconnectPeriod: 5000,
    });

    client.on('connect', () => {
      resolve(client);
    });

    client.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('🌐 MQTT Client-to-Client Test\n');

  // Create identities
  const identity1 = createMqttIdentity();
  const identity2 = createMqttIdentity();

  console.log('Client 1 Public Key:', identity1.publicKey);
  console.log('Client 2 Public Key:', identity2.publicKey);
  console.log('');

  // Topics for direct messaging
  const topic1to2 = `dm/${identity2.publicKey}`;
  const topic2to1 = `dm/${identity1.publicKey}`;

  const brokerUrl = BROKERS.flespi;
  console.log('📡 Connecting to MQTT broker:', brokerUrl);
  console.log('');

  try {
    // Connect both clients
    console.log('🔌 Client 1 connecting...');
    const client1 = await createClient(brokerUrl, `client1-${Date.now()}`);
    console.log('✅ Client 1 connected');

    console.log('🔌 Client 2 connecting...');
    const client2 = await createClient(brokerUrl, `client2-${Date.now()}`);
    console.log('✅ Client 2 connected\n');

    // Client 2 subscribes to its inbox
    console.log('👂 Client 2 subscribing to topic:', topic1to2);
    const messages2: string[] = [];

    await new Promise<void>((resolve, reject) => {
      client2.subscribe(topic1to2, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    client2.on('message', (topic, payload) => {
      if (topic === topic1to2) {
        const message = payload.toString();
        console.log('📬 Client 2 received:', message);
        messages2.push(message);
      }
    });

    console.log('✅ Client 2 subscribed\n');

    // Wait for subscription to be established
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Client 1 sends message to Client 2
    console.log('📤 Client 1 sending message to Client 2...');
    const message1 = JSON.stringify({
      from: identity1.publicKey,
      to: identity2.publicKey,
      content: 'Hello from Client 1! Testing MQTT protocol.',
      timestamp: Date.now(),
    });

    await new Promise<void>((resolve, reject) => {
      client1.publish(topic1to2, message1, { qos: 1, retain: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ Message published\n');

    // Wait for message delivery
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Client 1 subscribes to its inbox
    console.log('👂 Client 1 subscribing to topic:', topic2to1);
    const messages1: string[] = [];

    await new Promise<void>((resolve, reject) => {
      client1.subscribe(topic2to1, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    client1.on('message', (topic, payload) => {
      if (topic === topic2to1) {
        const message = payload.toString();
        console.log('📬 Client 1 received:', message);
        messages1.push(message);
      }
    });

    console.log('✅ Client 1 subscribed\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Client 2 sends response
    console.log('📤 Client 2 sending response to Client 1...');
    const message2 = JSON.stringify({
      from: identity2.publicKey,
      to: identity1.publicKey,
      content: 'Hello from Client 2! Got your message on MQTT!',
      timestamp: Date.now(),
    });

    await new Promise<void>((resolve, reject) => {
      client2.publish(topic2to1, message2, { qos: 1, retain: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ Response published\n');

    // Wait for response delivery
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Summary
    console.log('📊 Message Summary:');
    console.log(`  Client 1 received ${messages1.length} message(s):`);
    messages1.forEach(msg => {
      const parsed = JSON.parse(msg);
      console.log(`    From: ${parsed.from.slice(0, 8)}...`);
      console.log(`    Content: ${parsed.content}`);
    });
    console.log('');
    console.log(`  Client 2 received ${messages2.length} message(s):`);
    messages2.forEach(msg => {
      const parsed = JSON.parse(msg);
      console.log(`    From: ${parsed.from.slice(0, 8)}...`);
      console.log(`    Content: ${parsed.content}`);
    });
    console.log('');

    // Cleanup
    await new Promise<void>((resolve) => {
      client1.end(false, {}, () => {
        client2.end(false, {}, () => {
          resolve();
        });
      });
    });

    console.log('✅ MQTT test completed successfully!\n');
    console.log('Key Properties:');
    console.log('  - Identity: No built-in (using secp256k1 externally)');
    console.log('  - Encryption: Not built-in (transport can use TLS)');
    console.log('  - Addressing: Topics (dm/{pubkey})');
    console.log('  - Network: Centralized brokers (but many public options)');
    console.log('  - QoS: Quality of Service levels (0, 1, 2)');
    console.log('  - Retain: Messages can be retained for late subscribers');
    console.log('  - Persistence: Some brokers support session persistence');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
main().catch(console.error);
