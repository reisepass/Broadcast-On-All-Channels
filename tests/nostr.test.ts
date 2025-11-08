/**
 * Unit tests for Nostr channel
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateIdentity } from '../src/identity.js';
import { Broadcaster } from '../src/broadcaster.js';
import type { UnifiedIdentity } from '../src/identity.js';

describe('Nostr Channel Tests', () => {
  let sender: UnifiedIdentity;
  let receiver: UnifiedIdentity;
  let senderBroadcaster: Broadcaster;
  let receiverBroadcaster: Broadcaster;

  beforeAll(async () => {
    // Generate identities for sender and receiver
    sender = generateIdentity();
    receiver = generateIdentity();

    // Initialize broadcasters with only Nostr enabled
    const options = {
      xmtpEnabled: false,
      nostrEnabled: true,
      nostrRelays: [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.nostr.band',
      ],
      wakuEnabled: false,
      mqttEnabled: false,
      irohEnabled: false,
    };

    senderBroadcaster = new Broadcaster(sender, options);
    receiverBroadcaster = new Broadcaster(receiver, options);

    // Initialize both broadcasters
    await senderBroadcaster.initialize();
    await receiverBroadcaster.initialize();
  });

  afterAll(async () => {
    // Cleanup
    await senderBroadcaster.shutdown();
    await receiverBroadcaster.shutdown();
  });

  test('should initialize Nostr relays successfully', async () => {
    expect(senderBroadcaster).toBeDefined();
    expect(receiverBroadcaster).toBeDefined();
  });

  test('should send message via Nostr', async () => {
    const message = 'Test message via Nostr';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);

    // Should have exactly 1 result (only Nostr is enabled)
    expect(results.length).toBe(1);

    const nostrResult = results[0];
    expect(nostrResult.protocol).toContain('Nostr');
    expect(nostrResult.success).toBe(true);
    expect(nostrResult.latencyMs).toBeGreaterThan(0);
  });

  test('should broadcast to multiple relays', async () => {
    const message = 'Multi-relay test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const nostrResult = results[0];

    expect(nostrResult.success).toBe(true);
    // Protocol name should include relay count
    expect(nostrResult.protocol).toMatch(/Nostr \(\d+ relays?\)/);
  });

  test('should measure latency for Nostr message', async () => {
    const message = 'Latency test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const nostrResult = results[0];

    expect(nostrResult.latencyMs).toBeDefined();
    expect(nostrResult.latencyMs).toBeGreaterThan(0);
    // Sanity check: latency should be less than 30 seconds
    expect(nostrResult.latencyMs!).toBeLessThan(30000);
  });

  test('should handle encrypted direct messages', async () => {
    const secretMessage = 'This is a secret encrypted message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, secretMessage);
    const nostrResult = results[0];

    // Should succeed with encryption (NIP-04)
    expect(nostrResult.success).toBe(true);
  });

  test('should handle invalid recipient gracefully', async () => {
    const invalidMagnetLink = 'magnet:?xt=invalid';

    await expect(
      senderBroadcaster.broadcast(invalidMagnetLink, 'Test')
    ).rejects.toThrow();
  });

  test('should broadcast multiple messages sequentially', async () => {
    const messages = ['Nostr Message 1', 'Nostr Message 2', 'Nostr Message 3'];
    const results = [];

    for (const msg of messages) {
      const result = await senderBroadcaster.broadcast(receiver.magnetLink, msg);
      results.push(result);
    }

    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result[0].success).toBe(true);
      expect(result[0].protocol).toContain('Nostr');
    });
  });

  test('should handle empty message', async () => {
    const results = await senderBroadcaster.broadcast(receiver.magnetLink, '');

    expect(results.length).toBe(1);
    const nostrResult = results[0];
    // Nostr should handle empty messages
    expect(nostrResult.success).toBe(true);
  });

  test('should handle long messages', async () => {
    const longMessage = 'N'.repeat(5000); // 5KB message

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, longMessage);

    expect(results.length).toBe(1);
    const nostrResult = results[0];
    expect(nostrResult.success).toBe(true);
  });

  test('should work with minimal relay configuration', async () => {
    // Create a new broadcaster with only one relay
    const minimalOptions = {
      xmtpEnabled: false,
      nostrEnabled: true,
      nostrRelays: ['wss://relay.damus.io'],
      wakuEnabled: false,
      mqttEnabled: false,
      irohEnabled: false,
    };

    const minimalBroadcaster = new Broadcaster(sender, minimalOptions);
    await minimalBroadcaster.initialize();

    const results = await minimalBroadcaster.broadcast(receiver.magnetLink, 'Minimal relay test');

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);

    await minimalBroadcaster.shutdown();
  });
});
