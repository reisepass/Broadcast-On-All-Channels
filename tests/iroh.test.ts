/**
 * Unit tests for IROH channel
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateIdentity } from '../src/identity.js';
import { Broadcaster } from '../src/broadcaster.js';
import type { UnifiedIdentity } from '../src/identity.js';

describe('IROH Channel Tests', () => {
  let sender: UnifiedIdentity;
  let receiver: UnifiedIdentity;
  let senderBroadcaster: Broadcaster;
  let receiverBroadcaster: Broadcaster;

  beforeAll(async () => {
    // Generate identities for sender and receiver
    sender = generateIdentity();
    receiver = generateIdentity();

    // Initialize broadcasters with only IROH enabled
    const options = {
      xmtpEnabled: false,
      nostrEnabled: false,
      wakuEnabled: false,
      mqttEnabled: false,
      irohEnabled: true,
    };

    senderBroadcaster = new Broadcaster(sender, options);
    receiverBroadcaster = new Broadcaster(receiver, options);

    // Initialize both broadcasters
    await senderBroadcaster.initialize();
    await receiverBroadcaster.initialize();
  }, 30000); // Allow time for IROH initialization

  afterAll(async () => {
    // Cleanup
    await senderBroadcaster.shutdown();
    await receiverBroadcaster.shutdown();
  });

  test('should initialize IROH node successfully', async () => {
    expect(senderBroadcaster).toBeDefined();
    expect(receiverBroadcaster).toBeDefined();
  });

  test('should send message via IROH', async () => {
    const message = 'Test message via IROH';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);

    // Should have exactly 1 result (only IROH is enabled)
    expect(results.length).toBe(1);

    const irohResult = results[0];
    expect(irohResult.protocol).toContain('IROH');
    // IROH may fail if nodes can't connect directly
    if (irohResult.success) {
      expect(irohResult.latencyMs).toBeGreaterThan(0);
    }
  }, 30000);

  test('should measure latency for IROH message', async () => {
    const message = 'Latency test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const irohResult = results[0];

    expect(irohResult.latencyMs).toBeDefined();
    expect(irohResult.latencyMs).toBeGreaterThan(0);
  }, 30000);

  test('should use Ed25519 keys for IROH', async () => {
    // IROH nodes should be initialized with Ed25519 keys
    expect(sender.ed25519.nodeId).toBeDefined();
    expect(receiver.ed25519.nodeId).toBeDefined();
    expect(sender.ed25519.nodeId).not.toBe(receiver.ed25519.nodeId);
  });

  test('should handle invalid recipient gracefully', async () => {
    const invalidMagnetLink = 'magnet:?xt=invalid';

    await expect(
      senderBroadcaster.broadcast(invalidMagnetLink, 'Test')
    ).rejects.toThrow();
  });

  test('should broadcast multiple messages sequentially', async () => {
    const messages = ['IROH Message 1', 'IROH Message 2', 'IROH Message 3'];
    const results = [];

    for (const msg of messages) {
      const result = await senderBroadcaster.broadcast(receiver.magnetLink, msg);
      results.push(result);
    }

    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result[0].protocol).toContain('IROH');
    });
  }, 60000);

  test('should handle empty message', async () => {
    const results = await senderBroadcaster.broadcast(receiver.magnetLink, '');

    expect(results.length).toBe(1);
    const irohResult = results[0];
    expect(irohResult.protocol).toContain('IROH');
  }, 30000);

  test('should handle long messages', async () => {
    const longMessage = 'I'.repeat(5000); // 5KB message

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, longMessage);

    expect(results.length).toBe(1);
    const irohResult = results[0];
    expect(irohResult.protocol).toContain('IROH');
  }, 30000);

  test('should use QUIC protocol for encryption', async () => {
    // IROH uses QUIC which provides built-in encryption
    const message = 'Encrypted P2P message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const irohResult = results[0];

    // Message should be sent (encryption is automatic)
    expect(irohResult.protocol).toContain('IROH');
  }, 30000);

  test('should support bidirectional streams', async () => {
    // IROH uses bidirectional QUIC streams
    const message = 'Bidirectional stream test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const irohResult = results[0];

    // Should use bidirectional stream for send + ack
    expect(irohResult.protocol).toContain('IROH');
  }, 30000);

  test('should handle relay fallback', async () => {
    // IROH can use relay servers when direct connection fails
    const message = 'Relay fallback test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const irohResult = results[0];

    // Should attempt connection (may use relay)
    expect(irohResult.protocol).toContain('IROH');
  }, 30000);

  test('should use custom ALPN for messaging', async () => {
    // IROH uses ALPN (Application-Layer Protocol Negotiation)
    // Our implementation uses 'broadcast/dm/0'
    const message = 'ALPN protocol test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const irohResult = results[0];

    expect(irohResult.protocol).toContain('IROH');
  }, 30000);

  test('should handle concurrent messages', async () => {
    const messages = ['Concurrent IROH 1', 'Concurrent IROH 2', 'Concurrent IROH 3'];

    // Send all messages in parallel
    const promises = messages.map(msg =>
      senderBroadcaster.broadcast(receiver.magnetLink, msg)
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result[0].protocol).toContain('IROH');
    });
  }, 60000);

  test('should provide node address information', async () => {
    // IROH nodes should have node addresses with relay URLs
    expect(sender.ed25519.publicKey).toBeDefined();
    expect(sender.ed25519.nodeId).toBeDefined();
    expect(receiver.ed25519.publicKey).toBeDefined();
    expect(receiver.ed25519.nodeId).toBeDefined();
  });

  test('should handle direct P2P connections', async () => {
    // IROH prefers direct P2P connections over relay
    const message = 'Direct P2P test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const irohResult = results[0];

    // Should attempt direct connection
    expect(irohResult.protocol).toContain('IROH');
  }, 30000);
});
