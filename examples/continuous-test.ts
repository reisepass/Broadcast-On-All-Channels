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

interface ProtocolStats {
  sent: number;
  received: number;
  totalLatency: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  lastReceived?: number;
}

interface TestStats {
  protocols: Map<string, ProtocolStats>;
  totalSent: number;
  totalReceived: number;
  startTime: number;
  lastMessageReceived?: number;
}

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

function normalizeProtocolName(protocol: string): string {
  const lower = protocol.toLowerCase();
  if (lower.startsWith('mqtt')) return 'MQTT';
  if (lower.startsWith('nostr')) return 'Nostr';
  if (lower.startsWith('xmtp')) return 'XMTP';
  if (lower.startsWith('waku')) return 'Waku';
  if (lower.startsWith('iroh')) return 'IROH';
  return protocol;
}

function getProtocolStats(stats: TestStats, protocol: string): ProtocolStats {
  const normalized = normalizeProtocolName(protocol);
  if (!stats.protocols.has(normalized)) {
    stats.protocols.set(normalized, {
      sent: 0,
      received: 0,
      totalLatency: 0,
      avgLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
    });
  }
  return stats.protocols.get(normalized)!;
}

function updateReceivedStats(stats: TestStats, protocol: string, latencyMs: number) {
  const protocolStats = getProtocolStats(stats, protocol);
  protocolStats.received++;
  protocolStats.totalLatency += latencyMs;
  protocolStats.avgLatency = protocolStats.totalLatency / protocolStats.received;
  protocolStats.minLatency = Math.min(protocolStats.minLatency, latencyMs);
  protocolStats.maxLatency = Math.max(protocolStats.maxLatency, latencyMs);
  protocolStats.lastReceived = Date.now();
  stats.totalReceived++;
  stats.lastMessageReceived = Date.now();
}

function updateSentStats(stats: TestStats, protocol: string) {
  const protocolStats = getProtocolStats(stats, protocol);
  protocolStats.sent++;
  stats.totalSent++;
}

function displayStats(stats: TestStats, myMagnetLink: string, recipientMagnetLink: string) {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  console.clear();
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  CONTINUOUS MULTI-PROTOCOL TEST');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`My Magnet:        ${myMagnetLink.substring(0, 60)}...`);
  console.log(`Recipient Magnet: ${recipientMagnetLink.substring(0, 60)}...`);
  console.log('');
  console.log(`Uptime: ${hours}h ${minutes}m ${seconds}s`);
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

  const protocols = Array.from(stats.protocols.entries()).sort((a, b) => {
    // Sort by avg latency (fastest first)
    if (a[1].avgLatency === 0) return 1;
    if (b[1].avgLatency === 0) return -1;
    return a[1].avgLatency - b[1].avgLatency;
  });

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

  const stats: TestStats = {
    protocols: new Map(),
    totalSent: 0,
    totalReceived: 0,
    startTime: Date.now(),
  };

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
    console.log(`Total runtime: ${Math.floor((Date.now() - stats.startTime) / 1000)}s`);
    console.log(`Messages sent: ${stats.totalSent}`);
    console.log(`Messages received: ${stats.totalReceived}`);
    console.log('');

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
