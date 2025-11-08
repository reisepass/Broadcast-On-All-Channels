#!/usr/bin/env bun
/**
 * XMTP Client-to-Client Test
 *
 * XMTP uses Ethereum wallet signatures for identity (secp256k1)
 * Messages are encrypted end-to-end between wallet addresses
 *
 * Using the new @xmtp/node-sdk package (v3)
 */

import { Client, type Signer } from '@xmtp/node-sdk';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Helper to create XMTP-compatible signer from viem account
function createSigner(privateKey: `0x${string}`): Signer {
  const account = privateKeyToAccount(privateKey);

  return {
    walletType: 'EOA' as const,
    getAddress: () => account.address,
    signMessage: async (message: string) => {
      const signature = await account.signMessage({ message });
      // Convert hex signature to Uint8Array
      return new Uint8Array(
        signature.slice(2).match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
    },
  };
}

async function main() {
  console.log('🔐 XMTP Client-to-Client Test (V3 SDK)\n');

  try {
    // Create two random wallet accounts
    const privateKey1 = generatePrivateKey();
    const privateKey2 = generatePrivateKey();

    const account1 = privateKeyToAccount(privateKey1);
    const account2 = privateKeyToAccount(privateKey2);

    console.log('Wallet 1 Address:', account1.address);
    console.log('Wallet 2 Address:', account2.address);
    console.log('');

    // Create XMTP-compatible signers
    const signer1 = createSigner(privateKey1);
    const signer2 = createSigner(privateKey2);

    // Generate encryption keys (random for each client)
    const encryptionKey1 = crypto.getRandomValues(new Uint8Array(32));
    const encryptionKey2 = crypto.getRandomValues(new Uint8Array(32));

    // Initialize XMTP clients
    console.log('📡 Creating Client 1 (this may take a moment)...');
    const client1 = await Client.create(signer1, encryptionKey1, {
      env: 'dev', // Using dev environment for testing
    });
    console.log('✅ Client 1 created');

    console.log('📡 Creating Client 2...');
    const client2 = await Client.create(signer2, encryptionKey2, {
      env: 'dev',
    });
    console.log('✅ Client 2 created\n');

    // Client 1 creates a DM with Client 2
    console.log('📤 Client 1 creating DM with Client 2...');
    const dm1 = await client1.conversations.newDm(account2.address);
    await dm1.send('Hello from Client 1! Testing XMTP V3 protocol.');
    console.log('✅ Message sent\n');

    // Wait a bit for message propagation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Sync conversations for Client 2
    console.log('📥 Client 2 syncing conversations...');
    await client2.conversations.sync();
    const dms2 = client2.conversations.listDms();
    console.log(`📬 Client 2 has ${dms2.length} DM(s)\n`);

    if (dms2.length > 0) {
      const dm2 = dms2[0];
      await dm2.sync();
      const messages2 = await dm2.messages();

      console.log(`📬 Client 2 received ${messages2.length} message(s):`);
      for (const msg of messages2) {
        console.log(`  From: ${msg.senderInboxId}`);
        console.log(`  Content: ${msg.content}`);
        console.log(`  Sent: ${msg.sentAt.toISOString()}`);
      }
      console.log('');

      // Client 2 responds
      console.log('📤 Client 2 sending response...');
      await dm2.send('Hello from Client 2! Got your message on XMTP V3!');
      console.log('✅ Response sent\n');

      // Wait a bit for message propagation
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Client 1 syncs to see the response
    console.log('📥 Client 1 syncing messages...');
    await dm1.sync();
    const allMessages = await dm1.messages();

    console.log(`📬 Client 1 conversation has ${allMessages.length} total message(s):`);
    for (const msg of allMessages) {
      console.log(`  From: ${msg.senderInboxId}`);
      console.log(`  Content: ${msg.content}`);
      console.log(`  Sent: ${msg.sentAt.toISOString()}`);
    }

    console.log('\n✅ XMTP V3 test completed successfully!');
    console.log('\nKey Properties:');
    console.log('  - Identity: secp256k1 (Ethereum wallet)');
    console.log('  - Encryption: End-to-end encrypted (MLS)');
    console.log('  - Addressing: Ethereum address (0x...)');
    console.log('  - Network: XMTP V3 (dev/production)');
    console.log('  - Protocol: MLS (Messaging Layer Security)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
main().catch(console.error);
