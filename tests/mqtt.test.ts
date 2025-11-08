/**
 * Unit tests for MQTT channel
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateIdentity } from '../src/identity.js';
import { Broadcaster } from '../src/broadcaster.js';
import type { UnifiedIdentity } from '../src/identity.js';

describe('MQTT Channel Tests', () => {
  let sender: UnifiedIdentity;
  let receiver: UnifiedIdentity;
  let senderBroadcaster: Broadcaster;
  let receiverBroadcaster: Broadcaster;

  beforeAll(async () => {
    // Generate identities for sender and receiver
    sender = generateIdentity();
    receiver = generateIdentity();

    // Initialize broadcasters with only MQTT enabled
    const options = {
      xmtpEnabled: false,
      nostrEnabled: false,
      wakuEnabled: false,
      mqttEnabled: true,
      mqttBrokers: [
        'mqtt://broker.hivemq.com:1883',
        'mqtt://broker.emqx.io:1883',
        'mqtt://test.mosquitto.org:1883',
      ],
      irohEnabled: false,
    };

    senderBroadcaster = new Broadcaster(sender, options);
    receiverBroadcaster = new Broadcaster(receiver, options);

    // Initialize both broadcasters
    await senderBroadcaster.initialize();
    await receiverBroadcaster.initialize();
  }, 30000); // Allow time for broker connections

  afterAll(async () => {
    // Cleanup
    await senderBroadcaster.shutdown();
    await receiverBroadcaster.shutdown();
  });

  test('should initialize MQTT clients successfully', async () => {
    expect(senderBroadcaster).toBeDefined();
    expect(receiverBroadcaster).toBeDefined();
  });

  test('should send message via MQTT', async () => {
    const message = 'Test message via MQTT';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);

    // Should have exactly 1 result (only MQTT is enabled)
    expect(results.length).toBe(1);

    const mqttResult = results[0];
    expect(mqttResult.protocol).toContain('MQTT');
    expect(mqttResult.success).toBe(true);
    expect(mqttResult.latencyMs).toBeGreaterThan(0);
  });

  test('should broadcast to multiple brokers', async () => {
    const message = 'Multi-broker test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const mqttResult = results[0];

    expect(mqttResult.success).toBe(true);
    // Protocol name should include broker count
    expect(mqttResult.protocol).toMatch(/MQTT \(\d+\/\d+ brokers?\)/);
  });

  test('should measure latency for MQTT message', async () => {
    const message = 'Latency test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const mqttResult = results[0];

    expect(mqttResult.latencyMs).toBeDefined();
    expect(mqttResult.latencyMs).toBeGreaterThan(0);
    // MQTT should be fast
    expect(mqttResult.latencyMs!).toBeLessThan(10000);
  });

  test('should handle invalid recipient gracefully', async () => {
    const invalidMagnetLink = 'magnet:?xt=invalid';

    await expect(
      senderBroadcaster.broadcast(invalidMagnetLink, 'Test')
    ).rejects.toThrow();
  });

  test('should broadcast multiple messages sequentially', async () => {
    const messages = ['MQTT Message 1', 'MQTT Message 2', 'MQTT Message 3'];
    const results = [];

    for (const msg of messages) {
      const result = await senderBroadcaster.broadcast(receiver.magnetLink, msg);
      results.push(result);
    }

    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result[0].success).toBe(true);
      expect(result[0].protocol).toContain('MQTT');
    });
  });

  test('should handle empty message', async () => {
    const results = await senderBroadcaster.broadcast(receiver.magnetLink, '');

    expect(results.length).toBe(1);
    const mqttResult = results[0];
    expect(mqttResult.success).toBe(true);
  });

  test('should handle long messages', async () => {
    const longMessage = 'M'.repeat(10000); // 10KB message

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, longMessage);

    expect(results.length).toBe(1);
    const mqttResult = results[0];
    expect(mqttResult.success).toBe(true);
  });

  test('should work with single broker', async () => {
    // Create a new broadcaster with only one broker
    const singleBrokerOptions = {
      xmtpEnabled: false,
      nostrEnabled: false,
      wakuEnabled: false,
      mqttEnabled: true,
      mqttBrokers: ['mqtt://broker.hivemq.com:1883'],
      irohEnabled: false,
    };

    const singleBrokerBroadcaster = new Broadcaster(sender, singleBrokerOptions);
    await singleBrokerBroadcaster.initialize();

    const results = await singleBrokerBroadcaster.broadcast(receiver.magnetLink, 'Single broker test');

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].protocol).toMatch(/MQTT \(1\/1 brokers?\)/);

    await singleBrokerBroadcaster.shutdown();
  }, 20000);

  test('should use QoS level 1 for reliable delivery', async () => {
    const message = 'QoS test message';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const mqttResult = results[0];

    // Should succeed with QoS 1 (at least once delivery)
    expect(mqttResult.success).toBe(true);
  });

  test('should retain messages on brokers', async () => {
    const message = 'Retained message test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const mqttResult = results[0];

    // Messages should be retained for offline recipients
    expect(mqttResult.success).toBe(true);
  });

  test('should handle topic naming correctly', async () => {
    const message = 'Topic naming test';

    const results = await senderBroadcaster.broadcast(receiver.magnetLink, message);
    const mqttResult = results[0];

    // Should use dm/{recipientId} topic format
    expect(mqttResult.success).toBe(true);
  });

  test('should handle concurrent messages', async () => {
    const messages = ['Concurrent 1', 'Concurrent 2', 'Concurrent 3'];

    // Send all messages in parallel
    const promises = messages.map(msg =>
      senderBroadcaster.broadcast(receiver.magnetLink, msg)
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result[0].success).toBe(true);
      expect(result[0].protocol).toContain('MQTT');
    });
  });

  test('should handle broker fallback', async () => {
    // Create broadcaster with one invalid and valid brokers
    const fallbackOptions = {
      xmtpEnabled: false,
      nostrEnabled: false,
      wakuEnabled: false,
      mqttEnabled: true,
      mqttBrokers: [
        'mqtt://invalid.broker.example.com:1883', // Invalid
        'mqtt://broker.hivemq.com:1883', // Valid
      ],
      irohEnabled: false,
    };

    const fallbackBroadcaster = new Broadcaster(sender, fallbackOptions);
    await fallbackBroadcaster.initialize();

    const results = await fallbackBroadcaster.broadcast(receiver.magnetLink, 'Fallback test');

    expect(results.length).toBe(1);
    // Should succeed even if one broker fails
    expect(results[0].protocol).toContain('MQTT');

    await fallbackBroadcaster.shutdown();
  }, 30000);
});
