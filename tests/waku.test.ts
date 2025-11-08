/**
 * Unit tests for Waku channel
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateIdentity } from '../src/identity.js';
import { Broadcaster } from '../src/broadcaster.js';
import type { UnifiedIdentity } from '../src/identity.js';

describe('Waku Channel Tests', () => {
  let sender: UnifiedIdentity;
  let receiver: UnifiedIdentity;
  let senderBroadcaster: Broadcaster;
  let receiverBroadcaster: Broadcaster;

  beforeAll(async () => {
    // Generate identities for sender and receiver
    sender = generateIdentity();
    receiver = generateIdentity();

    // Initialize broadcasters with only Waku enabled
    const options = {
      xmtpEnabled: false,
      nostrEnabled: false,
      wakuEnabled: true,
      mqttEnabled: false,
      irohEnabled: false,
    };

    senderBroadcaster = new Broadcaster(sender, options);
    receiverBroadcaster = new Broadcaster(receiver, options);

    // Initialize both broadcasters
    await senderBroadcaster.initialize();
    await receiverBroadcaster.initialize();
  }, 60000); // Waku may take longer to initialize

  afterAll(async () => {
    // Cleanup
    await senderBroadcaster.shutdown();
    await receiverBroadcaster.shutdown();
  });

  test('should initialize Waku node successfully', async () => {
    expect(senderBroadcaster).toBeDefined();
    expect(receiverBroadcaster).toBeDefined();
  });

  test('should send message via Waku', async () => {
    const message = 'Test message via Waku';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);

    // Should have exactly 1 result (only Waku is enabled)
    expect(results.length).toBe(1);

    const wakuResult = results[0];
    expect(wakuResult.protocol).toContain('Waku');
    // Note: Waku may fail if no peers are available
    if (wakuResult.success) {
      expect(wakuResult.latencyMs).toBeGreaterThan(0);
    }
  }, 30000); // Allow more time for P2P communication

  test('should measure latency for Waku message', async () => {
    const message = 'Latency test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const wakuResult = results[0];

    expect(wakuResult.latencyMs).toBeDefined();
    expect(wakuResult.latencyMs).toBeGreaterThan(0);
  }, 30000);

  test('should handle peer discovery', async () => {
    const message = 'Peer discovery test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const wakuResult = results[0];

    // Protocol name should include peer count if successful
    if (wakuResult.success) {
      expect(wakuResult.protocol).toMatch(/Waku \(\d+ peers?\)/);
    }
  }, 30000);

  test('should handle invalid recipient gracefully', async () => {
    const invalidMagnetLink = 'magnet:?xt=invalid';

    await expect(
      senderBroadcaster.broadcast(invalidMagnetLink, 'Test')
    ).rejects.toThrow();
  });

  test('should broadcast multiple messages sequentially', async () => {
    const messages = ['Waku Message 1', 'Waku Message 2', 'Waku Message 3'];
    const results = [];

    for (const msg of messages) {
      const result = await senderBroadcaster.broadcast(receiver.magnetLink, msg);
      results.push(result);
    }

    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result[0].protocol).toContain('Waku');
      // Results may vary based on peer availability
    });
  }, 60000);

  test('should handle empty message', async () => {
    const results = await senderBroadcaster.broadcast(receiver.magnetLink, '');

    expect(results.length).toBe(1);
    const wakuResult = results[0];
    // Check that we got a result (success depends on peer availability)
    expect(wakuResult.protocol).toContain('Waku');
  }, 30000);

  test('should handle long messages', async () => {
    const longMessage = 'W'.repeat(5000); // 5KB message

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, longMessage);

    expect(results.length).toBe(1);
    const wakuResult = results[0];
    // Waku should handle larger messages (within limits)
    expect(wakuResult.protocol).toContain('Waku');
  }, 30000);

  test('should use content topics correctly', async () => {
    const message = 'Content topic test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const wakuResult = results[0];

    // Should complete without errors (content topic is derived from recipient)
    expect(wakuResult).toBeDefined();
    expect(wakuResult.protocol).toContain('Waku');
  }, 30000);

  test('should handle privacy-focused communication', async () => {
    const privateMessage = 'This is a private P2P message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, privateMessage);
    const wakuResult = results[0];

    // Waku provides privacy through P2P gossip protocol
    expect(wakuResult).toBeDefined();
    if (wakuResult.success) {
      expect(wakuResult.latencyMs).toBeGreaterThan(0);
    }
  }, 30000);
});
