#!/usr/bin/env bun
/**
 * Live Latency Demo
 *
 * Enhanced demo that:
 * - Sends multiple messages between two users
 * - Tracks live latency as messages arrive
 * - Displays comprehensive statistics from both perspectives
 * - Shows average latency, messages sent/received per protocol
 */

import { generateIdentity } from '../src/identity.js';
import { ChatBroadcaster } from '../src/chat-broadcaster.js';
import { ChatDatabase } from '../src/database.js';
import { supportsXMTP, logRuntimeInfo } from '../src/runtime.js';
import type { ChatMessage } from '../src/message-types.js';
import {
  type UserStats,
  type ProtocolStats,
  createUserStats,
  updateReceivedStats,
  updateSentStats,
  getSortedProtocols,
} from '../src/sdk/stats.js';

function displayStatsTable(user1Stats: UserStats, user2Stats: UserStats) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           PROTOCOL STATISTICS                                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');

  // Get all protocols
  const allProtocols = new Set([
    ...user1Stats.protocols.keys(),
    ...user2Stats.protocols.keys(),
  ]);

  // Table header
  console.log('║                    │         User 1         │         User 2         │         ║');
  console.log('║ Protocol           │  Sent  Recv  Avg (ms)  │  Sent  Recv  Avg (ms)  │ Status  ║');
  console.log('╟────────────────────┼────────────────────────┼────────────────────────┼─────────╢');

  for (const protocol of Array.from(allProtocols).sort()) {
    const stats1 = user1Stats.protocols.get(protocol) || {
      sent: 0,
      received: 0,
      avgLatency: 0,
      minLatency: 0,
      maxLatency: 0,
    };
    const stats2 = user2Stats.protocols.get(protocol) || {
      sent: 0,
      received: 0,
      avgLatency: 0,
      minLatency: 0,
      maxLatency: 0,
    };

    const name = protocol.padEnd(18);
    const u1Sent = String(stats1.sent).padStart(5);
    const u1Recv = String(stats1.received).padStart(5);
    const u1Avg = stats1.avgLatency > 0 ? String(Math.round(stats1.avgLatency)).padStart(9) : '        -';

    const u2Sent = String(stats2.sent).padStart(5);
    const u2Recv = String(stats2.received).padStart(5);
    const u2Avg = stats2.avgLatency > 0 ? String(Math.round(stats2.avgLatency)).padStart(9) : '        -';

    // Determine status
    const totalMessages = stats1.sent + stats2.sent;
    const totalReceived = stats1.received + stats2.received;
    let status = '   ✅   ';
    if (totalReceived === 0 && totalMessages > 0) {
      status = '   ❌   ';
    } else if (totalReceived < totalMessages && totalMessages > 0) {
      status = '   ⚠️    ';
    }

    console.log(`║ ${name} │ ${u1Sent} ${u1Recv} ${u1Avg} │ ${u2Sent} ${u2Recv} ${u2Avg} │ ${status}║`);
  }

  console.log('╟────────────────────┼────────────────────────┼────────────────────────┼─────────╢');

  const u1TotalSent = String(user1Stats.totalSent).padStart(5);
  const u1TotalRecv = String(user1Stats.totalReceived).padStart(5);
  const u2TotalSent = String(user2Stats.totalSent).padStart(5);
  const u2TotalRecv = String(user2Stats.totalReceived).padStart(5);

  console.log(`║ TOTAL              │ ${u1TotalSent} ${u1TotalRecv}          │ ${u2TotalSent} ${u2TotalRecv}          │         ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Live Multi-Protocol Latency Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Log runtime information
  logRuntimeInfo();

  // Initialize stats
  const user1Stats = createUserStats('User 1');
  const user2Stats = createUserStats('User 2');

  // Generate identities
  console.log('Generating identities...\n');
  const identity1 = generateIdentity();
  const identity2 = generateIdentity();

  // Create databases
  const db1 = new ChatDatabase('./data/demo-user1.db');
  const db2 = new ChatDatabase('./data/demo-user2.db');

  // Initialize broadcasters
  console.log('Initializing broadcasters...\n');
  const broadcaster1 = new ChatBroadcaster(identity1, db1);
  const broadcaster2 = new ChatBroadcaster(identity2, db2);

  await broadcaster1.initialize();
  await broadcaster2.initialize();

  // Set up message handlers
  broadcaster1.onMessage((message: ChatMessage, protocol: string) => {
    if (message.type === 'message') {
      const latency = Date.now() - message.timestamp;
      updateReceivedStats(user1Stats, protocol, latency);
      console.log(`  📨 User 1 ← ${protocol.padEnd(15)} ${Math.round(latency)}ms - "${message.content.substring(0, 40)}${message.content.length > 40 ? '...' : ''}"`);
    }
  });

  broadcaster2.onMessage((message: ChatMessage, protocol: string) => {
    if (message.type === 'message') {
      const latency = Date.now() - message.timestamp;
      updateReceivedStats(user2Stats, protocol, latency);
      console.log(`  📨 User 2 ← ${protocol.padEnd(15)} ${Math.round(latency)}ms - "${message.content.substring(0, 40)}${message.content.length > 40 ? '...' : ''}"`);
    }
  });

  // Start listening
  console.log('Starting listeners...\n');
  await broadcaster1.startListening();
  await broadcaster2.startListening();

  console.log('─────────────────────────────────────────────────────────\n');
  console.log('Sending messages...\n');

  // Messages to send
  const messages = [
    'Hello from User 1! Testing multi-protocol broadcast.',
    'Second message to test protocol reliability.',
    'Third message - checking latency consistency.',
    'Fourth message with some more content to test.',
    'Fifth and final message from User 1.',
  ];

  try {
    // Send messages from User 1 to User 2
    for (let i = 0; i < messages.length; i++) {
      console.log(`\n📤 User 1 → User 2: "${messages[i]}"\n`);
      const results = await broadcaster1.sendMessage(identity2.magnetLink, messages[i]);

      // Track sent messages
      for (const result of results) {
        if (result.success) {
          updateSentStats(user1Stats, result.protocol);
        }
      }

      // Wait a bit between messages to see live updates
      if (i < messages.length - 1) {
        await sleep(2000);
      }
    }

    // Wait for messages to propagate
    console.log('\n\nWaiting for messages to propagate...\n');
    await sleep(5000);

    // Send some messages back from User 2 to User 1
    const replies = [
      'User 2 here! Got your messages.',
      'Replying back to test bidirectional communication.',
      'Final reply from User 2.',
    ];

    for (let i = 0; i < replies.length; i++) {
      console.log(`\n📤 User 2 → User 1: "${replies[i]}"\n`);
      const results = await broadcaster2.sendMessage(identity1.magnetLink, replies[i]);

      // Track sent messages
      for (const result of results) {
        if (result.success) {
          updateSentStats(user2Stats, result.protocol);
        }
      }

      // Wait a bit between messages
      if (i < replies.length - 1) {
        await sleep(2000);
      }
    }

    // Wait for final messages
    console.log('\n\nWaiting for final messages...\n');
    await sleep(5000);

    // Display final statistics
    displayStatsTable(user1Stats, user2Stats);

    console.log('\n\n📊 Summary:\n');
    console.log(`  • Total messages sent by User 1: ${user1Stats.totalSent}`);
    console.log(`  • Total messages received by User 1: ${user1Stats.totalReceived}`);
    console.log(`  • Total messages sent by User 2: ${user2Stats.totalSent}`);
    console.log(`  • Total messages received by User 2: ${user2Stats.totalReceived}`);
    console.log('');

    // Protocol-specific insights
    console.log('💡 Protocol Insights:\n');
    for (const [protocol, stats] of user1Stats.protocols) {
      if (stats.received > 0) {
        console.log(`  ${protocol}:`);
        console.log(`    Avg Latency: ${Math.round(stats.avgLatency)}ms`);
        console.log(`    Min Latency: ${Math.round(stats.minLatency)}ms`);
        console.log(`    Max Latency: ${Math.round(stats.maxLatency)}ms`);
        console.log(`    Received: ${stats.received}/${stats.sent + user2Stats.protocols.get(protocol)?.sent || 0} messages`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
  } finally {
    // Cleanup
    console.log('\n\nCleaning up...\n');
    await broadcaster1.shutdown();
    await broadcaster2.shutdown();
    db1.close();
    db2.close();
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Test Complete');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run the demo
main().catch(console.error);
