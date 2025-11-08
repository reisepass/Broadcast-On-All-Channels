#!/usr/bin/env bun
/**
 * Nostr Client-to-Client Test
 *
 * Nostr uses secp256k1 keypairs for identity
 * Messages are sent as signed events to relays
 * Direct messages (NIP-04) are encrypted between users
 */

import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  nip04,
  type EventTemplate,
  type VerifiedEvent
} from 'nostr-tools';
import { Relay, useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';

// Use ws for Node.js/Bun environment
useWebSocketImplementation(WebSocket);

// Popular public Nostr relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

async function sendDirectMessage(
  relay: Relay,
  senderKey: Uint8Array,
  recipientPubkey: string,
  message: string
): Promise<void> {
  const senderPubkey = getPublicKey(senderKey);
  const encryptedContent = await nip04.encrypt(senderKey, recipientPubkey, message);

  const eventTemplate: EventTemplate = {
    kind: 4, // Encrypted Direct Message (NIP-04)
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkey]],
    content: encryptedContent,
  };

  const signedEvent = finalizeEvent(eventTemplate, senderKey);
  await relay.publish(signedEvent);
}

async function listenForDirectMessages(
  relay: Relay,
  recipientKey: Uint8Array,
  senderPubkey: string
): Promise<string[]> {
  const recipientPubkey = getPublicKey(recipientKey);
  const messages: string[] = [];

  return new Promise((resolve) => {
    const sub = relay.subscribe(
      [
        {
          kinds: [4],
          '#p': [recipientPubkey],
          authors: [senderPubkey],
        },
      ],
      {
        async onevent(event: VerifiedEvent) {
          try {
            const decrypted = await nip04.decrypt(
              recipientKey,
              event.pubkey,
              event.content
            );
            messages.push(decrypted);
          } catch (err) {
            console.error('Failed to decrypt message:', err);
          }
        },
        onclose() {
          resolve(messages);
        },
      }
    );

    // Close subscription after 3 seconds
    setTimeout(() => {
      sub.close();
    }, 3000);
  });
}

async function main() {
  console.log('🟣 Nostr Client-to-Client Test\n');

  // Generate two keypairs for testing
  const key1 = generateSecretKey();
  const key2 = generateSecretKey();
  const pubkey1 = getPublicKey(key1);
  const pubkey2 = getPublicKey(key2);

  console.log('Client 1 Pubkey:', pubkey1);
  console.log('Client 2 Pubkey:', pubkey2);
  console.log('');

  try {
    // Connect to a relay
    const relayUrl = RELAYS[0];
    console.log(`📡 Connecting to relay: ${relayUrl}`);

    const relay1 = await Relay.connect(relayUrl);
    console.log('✅ Client 1 connected to relay');

    const relay2 = await Relay.connect(relayUrl);
    console.log('✅ Client 2 connected to relay\n');

    // Client 2 starts listening
    console.log('👂 Client 2 listening for messages...');
    const messagesPromise = listenForDirectMessages(relay2, key2, pubkey1);

    // Wait a bit for subscription to be established
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Client 1 sends encrypted DM to Client 2
    console.log('📤 Client 1 sending encrypted message to Client 2...');
    await sendDirectMessage(
      relay1,
      key1,
      pubkey2,
      'Hello from Client 1! Testing Nostr protocol with NIP-04 encryption.'
    );
    console.log('✅ Message published to relay\n');

    // Wait for messages
    console.log('⏳ Waiting for message delivery...');
    const receivedMessages = await messagesPromise;

    console.log(`📬 Client 2 received ${receivedMessages.length} message(s):`);
    receivedMessages.forEach((msg, i) => {
      console.log(`  Message ${i + 1}: ${msg}`);
    });
    console.log('');

    // Client 2 responds
    console.log('📤 Client 2 sending response...');
    await sendDirectMessage(
      relay2,
      key2,
      pubkey1,
      'Hello from Client 2! Got your encrypted message on Nostr!'
    );
    console.log('✅ Response published to relay\n');

    // Client 1 listens for response
    console.log('👂 Client 1 listening for response...');
    const response = await listenForDirectMessages(relay1, key1, pubkey2);

    console.log(`📬 Client 1 received ${response.length} message(s):`);
    response.forEach((msg, i) => {
      console.log(`  Message ${i + 1}: ${msg}`);
    });

    // Cleanup
    relay1.close();
    relay2.close();

    console.log('\n✅ Nostr test completed successfully!');
    console.log('\nKey Properties:');
    console.log('  - Identity: secp256k1 keypair');
    console.log('  - Encryption: NIP-04 (encrypted DMs)');
    console.log('  - Addressing: Public key (hex)');
    console.log('  - Network: Multiple relay servers');
    console.log('  - Event Kind: 4 (Encrypted Direct Message)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
main().catch(console.error);
