#!/usr/bin/env node
/**
 * Continuous Multi-Protocol Test
 *
 * Designed for running on two separate computers to test real-world performance.
 *
 * Usage:
 *   npm run test:continuous --recipient <magnet-link> [--identity <index>] [--interval <seconds>]
 *
 * Example:
 *   npm run test:continuous -r "magnet:?xt=urn:btih:..." -i 0 --interval 10
 */

import { ChatBroadcaster } from '../src/chat-broadcaster.js';
import { ChatDatabase } from '../src/database.js';
import { IdentityStorage } from '../src/identity-storage.js';
import { decodeIdentity, displayIdentity } from '../src/identity.js';
import { logRuntimeInfo } from '../src/runtime.js';
import type { ChatMessage } from '../src/message-types.js';
import {
  type UserStats,
  type ProtocolStats,
  createUserStats,
  updateReceivedStats,
  updateSentStats,
  getSortedProtocols,
  formatUptime,
} from '../src/sdk/stats.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let recipient: string | undefined;
  let identityIndex = 0;
  let interval = 10; // seconds

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--recipient':
      case '-r':
        recipient = args[++i];
        break;
      case '--identity':
      case '-i':
        identityIndex = parseInt(args[++i]);
        break;
      case '--interval':
        interval = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        console.log(`
Continuous Multi-Protocol Test

Usage: npm run test:continuous --recipient <magnet-link> [options]

Options:
  -r, --recipient <magnet>   Recipient's magnet link (required)
  -i, --identity <index>     Local identity index to use (default: 0, oldest)
  --interval <seconds>       Seconds between messages (default: 10)
  -h, --help                 Show this help

Examples:
  npm run test:continuous -r "magnet:?xt=urn:btih:..."
  npm run test:continuous -r "magnet:?xt=urn:btih:..." -i 1 --interval 5
`);
        process.exit(0);
    }
  }

  if (!recipient) {
    console.error('Error: --recipient is required\n');
    console.error('Usage: npm run test:continuous --recipient <magnet-link>');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  return { recipient, identityIndex, interval };
}

// Stats functions now imported from SDK

function displayStats(stats: UserStats, myMagnetLink: string, recipientMagnetLink: string) {
  const uptime = formatUptime(stats.startTime!);

  console.clear();
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  CONTINUOUS MULTI-PROTOCOL TEST');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`My Magnet:        ${myMagnetLink.substring(0, 60)}...`);
  console.log(`Recipient Magnet: ${recipientMagnetLink.substring(0, 60)}...`);
  console.log('');
  console.log(`Uptime: ${uptime}`);
  console.log(`Total Sent: ${stats.totalSent} | Total Received: ${stats.totalReceived}`);

  if (stats.lastMessageReceived) {
    const timeSinceLast = Math.floor((Date.now() - stats.lastMessageReceived) / 1000);
    console.log(`Last received: ${timeSinceLast}s ago`);
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                      PROTOCOL STATISTICS                            │');
  console.log('├──────────────┬──────┬──────┬──────────┬──────────┬──────────────────┤');
  console.log('│ Protocol     │ Sent │ Recv │ Avg (ms) │ Min (ms) │ Max (ms)         │');
  console.log('├──────────────┼──────┼──────┼──────────┼──────────┼──────────────────┤');

  const protocols = getSortedProtocols(stats);

  for (const [protocol, pstats] of protocols) {
    const name = protocol.padEnd(12);
    const sent = String(pstats.sent).padStart(4);
    const recv = String(pstats.received).padStart(4);
    const avg = pstats.avgLatency > 0 ? String(Math.round(pstats.avgLatency)).padStart(8) : '       -';
    const min = pstats.minLatency < Infinity ? String(Math.round(pstats.minLatency)).padStart(8) : '       -';
    const max = pstats.maxLatency > 0 ? String(Math.round(pstats.maxLatency)).padStart(8) : '       -';

    console.log(`│ ${name} │ ${sent} │ ${recv} │ ${avg} │ ${min} │ ${max} │`);
  }

  console.log('└──────────────┴──────┴──────┴──────────┴──────────┴──────────────────┘');
  console.log('');
  console.log('Press Ctrl+C to stop');
}

async function main() {
  const { recipient, identityIndex, interval } = parseArgs();

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  Continuous Multi-Protocol Test');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');

  // Log runtime info
  logRuntimeInfo();

  // Load local identity
  console.log('Loading local identity...\n');
  const storage = new IdentityStorage();
  const storedIdentity = identityIndex === 0
    ? storage.getOrCreateFirstIdentity()
    : storage.getIdentityByIndex(identityIndex);

  if (!storedIdentity) {
    console.error(`Error: No identity found at index ${identityIndex}`);
    console.error('Run "npm run identity list" to see available identities');
    process.exit(1);
  }

  console.log(`Using identity #${identityIndex}:`);
  if (storedIdentity.label) {
    console.log(`Label: ${storedIdentity.label}`);
  }
  console.log(`Created: ${new Date(storedIdentity.createdAt).toLocaleString()}`);
  console.log('');
  displayIdentity(storedIdentity.identity);

  // Validate recipient magnet link
  console.log('\nValidating recipient magnet link...');
  try {
    const decoded = decodeIdentity(recipient);
    if (!decoded) {
      throw new Error('Invalid magnet link format');
    }
    console.log('✅ Recipient magnet link is valid\n');
  } catch (error) {
    console.error(`❌ Invalid magnet link: ${error}`);
    process.exit(1);
  }

  // Initialize broadcaster
  console.log('Initializing broadcaster...\n');
  const db = new ChatDatabase(`./data/continuous-test-${storedIdentity.id}.db`);
  const broadcaster = new ChatBroadcaster(storedIdentity.identity, db);

  const stats = createUserStats(`Identity-${identityIndex}`);

  // Set up message handler
  broadcaster.onMessage((message: ChatMessage, protocol: string) => {
    if (message.type === 'message') {
      const latency = Date.now() - message.timestamp;
      updateReceivedStats(stats, protocol, latency);
      displayStats(stats, storedIdentity.identity.magnetLink, recipient);
    }
  });

  await broadcaster.initialize();
  await broadcaster.startListening();

  console.log('✅ Ready! Starting continuous test...\n');
  console.log(`Sending message every ${interval} seconds to:`);
  console.log(`  ${recipient.substring(0, 70)}...`);
  console.log('');

  // Initial stats display
  displayStats(stats, storedIdentity.identity.magnetLink, recipient);

  let messageCount = 0;

  // Send messages on interval
  const sendInterval = setInterval(async () => {
    messageCount++;
    const message = `[${new Date().toISOString()}] Test message #${messageCount} from continuous test`;

    try {
      const results = await broadcaster.sendMessage(recipient, message);

      // Track sent messages
      for (const result of results) {
        if (result.success) {
          updateSentStats(stats, result.protocol);
        }
      }

      // Update display
      displayStats(stats, storedIdentity.identity.magnetLink, recipient);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, interval * 1000);

  // Handle shutdown
  const shutdown = async () => {
    console.log('\n\nShutting down...');
    clearInterval(sendInterval);
    await broadcaster.shutdown();
    db.close();

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Total runtime: ${formatUptime(stats.startTime!)}`);
    console.log(`Messages sent: ${stats.totalSent}`);
    console.log(`Messages received: ${stats.totalReceived}`);
    console.log('');

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
