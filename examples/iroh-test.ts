#!/usr/bin/env bun
/**
 * IROH Test - Peer-to-Peer Messaging
 *
 * Demonstrates:
 * 1. Creating IROH nodes
 * 2. Custom protocol for messaging
 * 3. Direct peer-to-peer connections
 */

import { Iroh } from '@number0/iroh';

const MESSAGING_ALPN = Buffer.from('broadcast/dm/0');

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  IROH Peer-to-Peer Messaging Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Step 1: Creating two IROH nodes\n');

  // Define the messaging protocol handler
  const protocols = {
    [MESSAGING_ALPN.toString()]: (err: Error | null, ep: any) => ({
      accept: async (err: Error | null, conn: any) => {
        if (err) {
          console.error('Accept error:', err);
          return;
        }

        const nodeId = await ep.nodeId();
        console.log(`📥 Node ${nodeId.slice(0, 8)}... accepting connection`);

        const remote = await conn.remoteNodeId();
        console.log(`   From: ${remote.toString().slice(0, 8)}...`);

        // Accept bidirectional stream
        const bi = await conn.acceptBi();

        // Read the message
        const bytes = await bi.recv.readToEnd(1024);
        const message = bytes.toString();
        console.log(`   Message: "${message}"\n`);

        // Send acknowledgment
        const ack = `ACK: Received "${message}"`;
        await bi.send.writeAll(Buffer.from(ack));
        await bi.send.finish();

        await conn.closed();
      },
      shutdown: (err: Error | null) => {
        if (err && !err.message?.includes('closed')) {
          console.error('Shutdown error:', err);
        }
      },
    }),
  };

  // Create Node 1 (receiver)
  console.log('Creating Node 1 (receiver)...');
  const node1 = await Iroh.memory({ protocols });
  const node1Addr = await node1.net.nodeAddr();
  const node1Id = await node1.net.nodeId();
  console.log(`✅ Node 1 created: ${node1Id.slice(0, 16)}...`);
  console.log(`   Relay: ${node1Addr.relayUrl || 'none'}\n`);

  // Create Node 2 (sender)
  console.log('Creating Node 2 (sender)...');
  const node2 = await Iroh.memory({ protocols });
  const node2Id = await node2.net.nodeId();
  console.log(`✅ Node 2 created: ${node2Id.slice(0, 16)}...\n`);

  console.log('─────────────────────────────────────────────────────────\n');
  console.log('Step 2: Sending message from Node 2 to Node 1\n');

  const message = 'Hello from IROH! This is a direct P2P message.';
  console.log(`📤 Sending: "${message}"`);

  try {
    // Get endpoint from Node 2
    const endpoint = node2.node.endpoint();

    // Connect to Node 1
    console.log(`   Connecting to ${node1Addr.nodeId.slice(0, 8)}...`);
    const conn = await endpoint.connect(node1Addr, MESSAGING_ALPN);

    const remote = await conn.remoteNodeId();
    console.log(`   ✅ Connected to ${remote.toString().slice(0, 8)}...\n`);

    // Open bidirectional stream
    const bi = await conn.openBi();

    // Send message
    await bi.send.writeAll(Buffer.from(message));
    await bi.send.finish();

    // Read acknowledgment
    const ackBuffer = Buffer.alloc(256);
    const bytesRead = await bi.recv.readToEnd(256);
    const ack = bytesRead.toString();

    console.log(`   📨 Response: "${ack}"\n`);

    console.log('─────────────────────────────────────────────────────────\n');
    console.log('✅ IROH Test Successful!\n');

    console.log('Features Demonstrated:');
    console.log('  • Direct peer-to-peer connections');
    console.log('  • Custom protocol (ALPN)');
    console.log('  • Bidirectional streaming');
    console.log('  • Automatic relay fallback (if needed)');
    console.log('  • End-to-end encryption (QUIC)\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Cleanup
    console.log('Shutting down nodes...');
    await node2.node.shutdown();
    await node1.node.shutdown();
    console.log('✅ Nodes shut down\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Test Complete');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run the test
main().catch(console.error);
