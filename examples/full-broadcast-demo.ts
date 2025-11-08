#!/usr/bin/env bun
/**
 * Full Broadcast System Demo
 *
 * Demonstrates the complete multi-protocol broadcast system:
 * 1. Generate unified identities for two users
 * 2. Initialize broadcaster for User 1
 * 3. Broadcast a message to User 2 across all protocols
 * 4. Show which protocols succeeded and their latencies
 */

import { generateIdentity, displayIdentity } from '../src/identity.js';
import { Broadcaster } from '../src/broadcaster.js';
import { supportsXMTP, logRuntimeInfo } from '../src/runtime.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Multi-Protocol Broadcast System Demo');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Log runtime information
  logRuntimeInfo();

  // Generate identities for two users
  console.log('Step 1: Generating identities\n');
  console.log('─────────────────────────────────────────────────────────\n');

  const identity1 = generateIdentity();
  console.log('👤 User 1 Identity:');
  displayIdentity(identity1);

  const identity2 = generateIdentity();
  console.log('👤 User 2 Identity:');
  displayIdentity(identity2);

  console.log('─────────────────────────────────────────────────────────\n');
  console.log('Step 2: Initializing broadcasters for both users\n');

  // Auto-detect runtime and enable XMTP only on Node.js/Deno
  const xmtpSupported = supportsXMTP();
  const broadcasterOptions = {
    xmtpEnabled: xmtpSupported, // Auto-enabled on Node.js/Deno
    xmtpEnv: 'dev' as const,
    nostrEnabled: true, // ✅ Enabled - fully working!
    wakuEnabled: true,  // ✅ Enabled - Privacy-focused P2P!
    mqttEnabled: true,  // ✅ Enabled - fully working with 3 brokers!
    mqttBrokers: [
      'mqtt://broker.hivemq.com:1883',
      'mqtt://broker.emqx.io:1883',
      'mqtt://test.mosquitto.org:1883',
    ],
    irohEnabled: true,  // ✅ Enabled - P2P with direct connections!
  };

  // Initialize broadcaster for User 1
  console.log('Initializing broadcaster for User 1...');
  const broadcaster1 = new Broadcaster(identity1, broadcasterOptions);
  await broadcaster1.initialize();

  // Initialize broadcaster for User 2 (to register on XMTP)
  console.log('Initializing broadcaster for User 2...');
  const broadcaster2 = new Broadcaster(identity2, broadcasterOptions);
  await broadcaster2.initialize();

  try {
    console.log('─────────────────────────────────────────────────────────\n');
    console.log('Step 3: Broadcasting message from User 1 to User 2\n');

    const protocols = xmtpSupported
      ? 'XMTP, Nostr, Waku, MQTT, and IROH'
      : 'Nostr, Waku, MQTT, and IROH';
    const message = `Hello! This is a test of the multi-protocol broadcast system. You should receive this on ${protocols}!`;

    console.log('📤 Message:', message);
    console.log('📬 Recipient:', identity2.magnetLink);
    console.log('');

    // Broadcast the message from User 1 to User 2
    const results = await broadcaster1.broadcast(identity2.magnetLink, message);

    console.log('─────────────────────────────────────────────────────────\n');
    console.log('Step 4: Broadcast Results\n');

    // Display results
    console.log('📊 Protocol Results:\n');

    let successCount = 0;
    let failCount = 0;

    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const latency = result.latencyMs ? `${result.latencyMs}ms` : 'N/A';

      console.log(`${status} ${result.protocol.padEnd(25)} ${latency.padStart(8)}`);

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
    });

    console.log('');
    console.log(`✅ Success: ${successCount}/${results.length} protocols`);
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount}/${results.length} protocols`);
    }

    if (successCount === 0) {
      console.log('\n⚠️  All protocols failed. The message was not delivered.');
    } else if (successCount < results.length) {
      console.log('\n⚠️  Some protocols failed, but the message was delivered via others.');
    } else {
      console.log('\n🎉 Message successfully delivered via all protocols!');
    }

    console.log('\n─────────────────────────────────────────────────────────\n');
    console.log('💡 Key Features:\n');
    console.log('  • Automatic Fallback: If one protocol fails, others still work');
    console.log('  • Parallel Broadcasting: All protocols contacted simultaneously');
    console.log('  • Unified Identity: Single magnet link works across all protocols');
    console.log('  • No Signup Required: All protocols are permissionless and anonymous');
    console.log('  • Redundancy: Message delivered via multiple independent networks');
    console.log('');

    console.log('📝 Protocol Comparison:\n');
    if (xmtpSupported) {
      console.log('  XMTP:  E2E encrypted, Ethereum-based, production-ready');
    }
    console.log('  Nostr: Decentralized relays, simple protocol, wide adoption');
    console.log('  Waku:  Privacy-focused P2P, light client, gossip protocol');
    console.log('  MQTT:  Established IoT protocol, many public brokers');
    console.log('  IROH:  Direct P2P connections, QUIC encrypted, relay fallback');
    console.log('');
    if (!xmtpSupported) {
      console.log('⚠️  Note: XMTP is disabled - requires Node.js or Deno (Bun has native binding issues).');
      console.log('   Run with Node.js or Deno to enable XMTP support.');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error during broadcast:', error);
  } finally {
    // Cleanup both broadcasters
    await broadcaster1.shutdown();
    await broadcaster2.shutdown();
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Demo Complete');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run the demo
main().catch(console.error);
