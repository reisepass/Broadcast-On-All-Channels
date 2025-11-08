/**
 * Integration tests for multi-channel broadcasting
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateIdentity } from '../src/identity.js';
import { Broadcaster } from '../src/broadcaster.js';
import type { UnifiedIdentity } from '../src/identity.js';

describe('Multi-Channel Integration Tests', () => {
  let sender: UnifiedIdentity;
  let receiver: UnifiedIdentity;
  let broadcaster: Broadcaster;
  let receiverBroadcaster: Broadcaster;

  beforeAll(async () => {
    // Generate identities
    sender = generateIdentity();
    receiver = generateIdentity();

    // Initialize with all channels enabled
    const options = {
      xmtpEnabled: true,
      xmtpEnv: 'dev' as const,
      nostrEnabled: true,
      nostrRelays: ['wss://relay.damus.io', 'wss://nos.lol'],
      wakuEnabled: true,
      mqttEnabled: true,
      mqttBrokers: [
        'mqtt://broker.hivemq.com:1883',
        'mqtt://broker.emqx.io:1883',
      ],
      irohEnabled: true,
    };

    broadcaster = new Broadcaster(sender, options);
    receiverBroadcaster = new Broadcaster(receiver, options);

    await broadcaster.initialize();
    await receiverBroadcaster.initialize();
  }, 90000); // Allow time for all protocols to initialize

  afterAll(async () => {
    await broadcaster.shutdown();
    await receiverBroadcaster.shutdown();
  });

  test('should broadcast to all channels simultaneously', async () => {
    const message = 'Multi-channel broadcast test';

    const results = await broadcaster.broadcast(receiver.magnetLink, message);

    // Should have results from all enabled protocols
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5); // Max 5 protocols

    // Check that we have results from expected protocols
    const protocols = results.map(r => r.protocol);
    const hasXMTP = protocols.some(p => p.includes('XMTP'));
    const hasNostr = protocols.some(p => p.includes('Nostr'));
    const hasMQTT = protocols.some(p => p.includes('MQTT'));
    // Waku and IROH may not always succeed due to P2P requirements

    expect(hasXMTP || hasNostr || hasMQTT).toBe(true);
  }, 60000);

  test('should provide redundancy across channels', async () => {
    const message = 'Redundancy test message';

    const results = await broadcaster.broadcast(receiver.magnetLink, message);

    // Count successful channels
    const successfulChannels = results.filter(r => r.success);

    // At least one channel should succeed
    expect(successfulChannels.length).toBeGreaterThan(0);

    // Log success rate
    console.log(`Success rate: ${successfulChannels.length}/${results.length} channels`);
  }, 60000);

  test('should handle partial failures gracefully', async () => {
    const message = 'Partial failure test';

    const results = await broadcaster.broadcast(receiver.magnetLink, message);

    // Even if some channels fail, others should succeed
    const hasSuccess = results.some(r => r.success);
    const hasFailure = results.some(r => !r.success);

    expect(hasSuccess).toBe(true); // At least one should succeed

    // Log which channels failed
    const failedChannels = results.filter(r => !r.success);
    if (failedChannels.length > 0) {
      console.log('Failed channels:', failedChannels.map(r => r.protocol));
    }
  }, 60000);

  test('should measure relative latencies across channels', async () => {
    const message = 'Latency comparison test';

    const results = await broadcaster.broadcast(receiver.magnetLink, message);

    const successfulResults = results.filter(r => r.success && r.latencyMs);

    if (successfulResults.length > 1) {
      // Compare latencies
      const latencies = successfulResults.map(r => ({
        protocol: r.protocol,
        latency: r.latencyMs!,
      }));

      latencies.sort((a, b) => a.latency - b.latency);

      console.log('Latency ranking:');
      latencies.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.protocol}: ${item.latency}ms`);
      });

      // All latencies should be reasonable (under 60 seconds)
      latencies.forEach(item => {
        expect(item.latency).toBeLessThan(60000);
      });
    }
  }, 60000);

  test('should broadcast different message types', async () => {
    const testMessages = [
      'Simple text',
      'Message with special chars: !@#$%^&*()',
      'Unicode message: 你好世界 🌍',
      JSON.stringify({ type: 'structured', data: 'test' }),
    ];

    for (const msg of testMessages) {
      const results = await broadcaster.broadcast(receiver.magnetLink, msg);
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    }
  }, 120000);

  test('should maintain identity consistency across channels', async () => {
    // All channels should use the same unified identity
    expect(sender.secp256k1.publicKey).toBeDefined();
    expect(sender.ed25519.publicKey).toBeDefined();
    expect(sender.magnetLink).toContain(sender.secp256k1.publicKey);
    expect(sender.magnetLink).toContain(sender.ed25519.publicKey);
  });

  test('should handle rapid sequential broadcasts', async () => {
    const messages = Array.from({ length: 5 }, (_, i) => `Rapid message ${i + 1}`);
    const results = [];

    for (const msg of messages) {
      const result = await broadcaster.broadcast(receiver.magnetLink, msg);
      results.push(result);
    }

    expect(results.length).toBe(5);
    results.forEach(result => {
      const successCount = result.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });
  }, 120000);

  test('should provide detailed error information on failures', async () => {
    const message = 'Error information test';

    const results = await broadcaster.broadcast(receiver.magnetLink, message);

    results.forEach(result => {
      expect(result.protocol).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.latencyMs).toBeDefined();

      if (!result.success) {
        // Failed results should have error information
        expect(result.error).toBeDefined();
        console.log(`${result.protocol} failed:`, result.error);
      }
    });
  }, 60000);

  test('should demonstrate automatic fallback', async () => {
    const message = 'Fallback demonstration';

    const results = await broadcaster.broadcast(receiver.magnetLink, message);

    // The system should succeed overall even if individual channels fail
    const overallSuccess = results.some(r => r.success);
    expect(overallSuccess).toBe(true);

    // Log the fallback scenario
    const successfulChannels = results.filter(r => r.success).map(r => r.protocol);
    const failedChannels = results.filter(r => !r.success).map(r => r.protocol);

    console.log('Successful channels:', successfulChannels);
    if (failedChannels.length > 0) {
      console.log('Failed channels (fell back from):', failedChannels);
    }
  }, 60000);

  test('should handle all channels being disabled', async () => {
    // Create a broadcaster with all channels disabled
    const disabledBroadcaster = new Broadcaster(sender, {
      xmtpEnabled: false,
      nostrEnabled: false,
      wakuEnabled: false,
      mqttEnabled: false,
      irohEnabled: false,
    });

    await disabledBroadcaster.initialize();

    const results = await disabledBroadcaster.broadcast(receiver.magnetLink, 'Test');

    // Should return empty results
    expect(results.length).toBe(0);

    await disabledBroadcaster.shutdown();
  });

  test('should support selective channel enabling', async () => {
    // Create broadcaster with only specific channels
    const selectiveBroadcaster = new Broadcaster(sender, {
      xmtpEnabled: true,
      xmtpEnv: 'dev' as const,
      nostrEnabled: true,
      wakuEnabled: false,
      mqttEnabled: false,
      irohEnabled: false,
    });

    await selectiveBroadcaster.initialize();

    const results = await selectiveBroadcaster.broadcast(receiver.magnetLink, 'Selective test');

    // Should only have results from enabled channels
    expect(results.length).toBe(2); // XMTP + Nostr
    expect(results.every(r => r.protocol.includes('XMTP') || r.protocol.includes('Nostr'))).toBe(true);

    await selectiveBroadcaster.shutdown();
  }, 60000);
});
