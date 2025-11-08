/**
 * Unit tests for XMTP channel
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateIdentity } from '../src/identity.js';
import { Broadcaster } from '../src/broadcaster.js';
import type { UnifiedIdentity } from '../src/identity.js';

describe('XMTP Channel Tests', () => {
  let sender: UnifiedIdentity;
  let receiver: UnifiedIdentity;
  let senderBroadcaster: Broadcaster;
  let receiverBroadcaster: Broadcaster;

  beforeAll(async () => {
    // Generate identities for sender and receiver
    sender = generateIdentity();
    receiver = generateIdentity();

    // Initialize broadcasters with only XMTP enabled
    const options = {
      xmtpEnabled: true,
      xmtpEnv: 'dev' as const,
      nostrEnabled: false,
      wakuEnabled: false,
      mqttEnabled: false,
      irohEnabled: false,
    };

    senderBroadcaster = new Broadcaster(sender, options);
    receiverBroadcaster = new Broadcaster(receiver, options);

    // Initialize both broadcasters (needed for XMTP registration)
    await senderBroadcaster.initialize();
    await receiverBroadcaster.initialize();
  });

  afterAll(async () => {
    // Cleanup
    await senderBroadcaster.shutdown();
    await receiverBroadcaster.shutdown();
  });

  test('should initialize XMTP client successfully', async () => {
    expect(senderBroadcaster).toBeDefined();
    expect(receiverBroadcaster).toBeDefined();
  });

  test('should send message via XMTP', async () => {
    const message = 'Test message via XMTP';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);

    // Should have exactly 1 result (only XMTP is enabled)
    expect(results.length).toBe(1);

    const xmtpResult = results[0];
    expect(xmtpResult.protocol).toContain('XMTP');
    expect(xmtpResult.success).toBe(true);
    expect(xmtpResult.latencyMs).toBeGreaterThan(0);
  });

  test('should measure latency for XMTP message', async () => {
    const message = 'Latency test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const xmtpResult = results[0];

    expect(xmtpResult.latencyMs).toBeDefined();
    expect(xmtpResult.latencyMs).toBeGreaterThan(0);
    // Sanity check: latency should be less than 30 seconds
    expect(xmtpResult.latencyMs!).toBeLessThan(30000);
  });

  test('should handle invalid recipient gracefully', async () => {
    const invalidMagnetLink = 'magnet:?xt=invalid';

    await expect(
      senderBroadcaster.broadcast(invalidMagnetLink, 'Test')
    ).rejects.toThrow();
  });

  test('should broadcast multiple messages sequentially', async () => {
    const messages = ['Message 1', 'Message 2', 'Message 3'];
    const results = [];

    for (const msg of messages) {
      const result = await senderBroadcaster.broadcast(receiver.magnetLink, msg);
      results.push(result);
    }

    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result[0].success).toBe(true);
      expect(result[0].protocol).toContain('XMTP');
    });
  });

  test('should handle empty message', async () => {
    const results = await senderBroadcaster.broadcast(receiver.magnetLink, '');

    expect(results.length).toBe(1);
    const xmtpResult = results[0];
    // XMTP should still succeed with empty message
    expect(xmtpResult.success).toBe(true);
  });

  test('should handle long messages', async () => {
    const longMessage = 'A'.repeat(10000); // 10KB message

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, longMessage);

    expect(results.length).toBe(1);
    const xmtpResult = results[0];
    expect(xmtpResult.success).toBe(true);
  });
});
