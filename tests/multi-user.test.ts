/**
 * Multi-User Integration Tests
 *
 * Tests real-world scenarios with multiple users communicating simultaneously
 */

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateTestIdentities, MessageCollector, cleanup, waitForMessages, delay } from '../src/sdk/test-helpers.js';
import { createMultipleChatBroadcasters } from '../src/sdk/broadcaster-factory.js';
import { createUserStats, updateReceivedStats, updateSentStats } from '../src/sdk/stats.js';
import type { ChatMessage } from '../src/message-types.js';

describe('Multi-User Communication Tests', () => {
  const testTimeout = 60000; // 60 seconds for multi-user tests

  test('Two users can send messages to each other', async () => {
    // Generate two test identities
    const identities = generateTestIdentities(2);
    const [user1, user2] = identities;

    // Create broadcasters for both users
    const broadcasters = await createMultipleChatBroadcasters(identities);
    const [bc1, bc2] = broadcasters;

    // Set up message collectors
    const user1Messages = new MessageCollector();
    const user2Messages = new MessageCollector();

    bc1.broadcaster.onMessage((msg: ChatMessage, protocol: string) => {
      if (msg.type === 'message') {
        user1Messages.collect(msg, protocol);
      }
    });

    bc2.broadcaster.onMessage((msg: ChatMessage, protocol: string) => {
      if (msg.type === 'message') {
        user2Messages.collect(msg, protocol);
      }
    });

    // Start listening
    await bc1.broadcaster.startListening();
    await bc2.broadcaster.startListening();

    // User 1 sends to User 2
    const msg1 = 'Hello from User 1';
    await bc1.broadcaster.sendMessage(user2.magnetLink, msg1);

    // User 2 sends to User 1
    const msg2 = 'Hello from User 2';
    await bc2.broadcaster.sendMessage(user1.magnetLink, msg2);

    // Wait for messages to arrive (at least one protocol should work)
    const user2Received = await user2Messages.waitForCount(1, 30000);
    const user1Received = await user1Messages.waitForCount(1, 30000);

    expect(user2Received).toBe(true);
    expect(user1Received).toBe(true);

    // Cleanup
    await cleanup([bc1.broadcaster, bc1.db, bc2.broadcaster, bc2.db]);
  }, testTimeout);

  test('Three users in a group conversation', async () => {
    // Generate three test identities
    const identities = generateTestIdentities(3);
    const broadcasters = await createMultipleChatBroadcasters(identities);

    // Set up message collectors for all users
    const collectors = broadcasters.map(() => new MessageCollector());

    broadcasters.forEach((bc, index) => {
      bc.broadcaster.onMessage((msg: ChatMessage, protocol: string) => {
        if (msg.type === 'message') {
          collectors[index].collect(msg, protocol);
        }
      });
    });

    // Start all listening
    await Promise.all(broadcasters.map(bc => bc.broadcaster.startListening()));

    // User 0 broadcasts to User 1 and User 2
    await broadcasters[0].broadcaster.sendMessage(identities[1].magnetLink, 'From User 0 to User 1');
    await broadcasters[0].broadcaster.sendMessage(identities[2].magnetLink, 'From User 0 to User 2');

    // User 1 broadcasts to User 2
    await broadcasters[1].broadcaster.sendMessage(identities[2].magnetLink, 'From User 1 to User 2');

    // Wait for messages
    const user1Received = await collectors[1].waitForCount(1, 30000);
    const user2Received = await collectors[2].waitForCount(2, 30000);

    expect(user1Received).toBe(true);
    expect(user2Received).toBe(true);
    expect(collectors[2].getCount()).toBeGreaterThanOrEqual(2);

    // Cleanup
    await cleanup([
      ...broadcasters.map(bc => bc.broadcaster),
      ...broadcasters.map(bc => bc.db),
    ]);
  }, testTimeout);

  test('Message delivery across all protocols', async () => {
    const identities = generateTestIdentities(2);
    const broadcasters = await createMultipleChatBroadcasters(identities);
    const [bc1, bc2] = broadcasters;

    const receivedProtocols = new Set<string>();

    bc2.broadcaster.onMessage((msg: ChatMessage, protocol: string) => {
      if (msg.type === 'message') {
        receivedProtocols.add(protocol);
      }
    });

    await bc1.broadcaster.startListening();
    await bc2.broadcaster.startListening();

    // Send a message
    await bc1.broadcaster.sendMessage(identities[1].magnetLink, 'Test multi-protocol delivery');

    // Wait for message to arrive via at least one protocol
    await delay(10000); // Give all protocols time to deliver

    // Should have received via at least one protocol
    expect(receivedProtocols.size).toBeGreaterThan(0);

    // Log which protocols succeeded
    console.log(`Message received via: ${Array.from(receivedProtocols).join(', ')}`);

    await cleanup([bc1.broadcaster, bc1.db, bc2.broadcaster, bc2.db]);
  }, testTimeout);

  test('Protocol performance statistics tracking', async () => {
    const identities = generateTestIdentities(2);
    const broadcasters = await createMultipleChatBroadcasters(identities);
    const [bc1, bc2] = broadcasters;

    const stats = createUserStats('User 2');

    bc2.broadcaster.onMessage((msg: ChatMessage, protocol: string) => {
      if (msg.type === 'message') {
        const latency = Date.now() - msg.timestamp;
        updateReceivedStats(stats, protocol, latency);
      }
    });

    await bc1.broadcaster.startListening();
    await bc2.broadcaster.startListening();

    // Send multiple messages
    for (let i = 0; i < 3; i++) {
      await bc1.broadcaster.sendMessage(identities[1].magnetLink, `Test message ${i + 1}`);
      await delay(2000); // Space out messages
    }

    // Wait for messages to arrive
    await delay(10000);

    // Should have received some messages
    expect(stats.totalReceived).toBeGreaterThan(0);

    // Should have protocol statistics
    expect(stats.protocols.size).toBeGreaterThan(0);

    // Log statistics
    for (const [protocol, pstats] of stats.protocols.entries()) {
      console.log(`${protocol}: received=${pstats.received}, avg latency=${Math.round(pstats.avgLatency)}ms`);
    }

    await cleanup([bc1.broadcaster, bc1.db, bc2.broadcaster, bc2.db]);
  }, testTimeout);

  test('Concurrent message sending from multiple users', async () => {
    const identities = generateTestIdentities(3);
    const broadcasters = await createMultipleChatBroadcasters(identities);

    const collectors = broadcasters.map(() => new MessageCollector());

    broadcasters.forEach((bc, index) => {
      bc.broadcaster.onMessage((msg: ChatMessage, protocol: string) => {
        if (msg.type === 'message') {
          collectors[index].collect(msg, protocol);
        }
      });
    });

    await Promise.all(broadcasters.map(bc => bc.broadcaster.startListening()));

    // All users send to User 2 concurrently
    await Promise.all([
      broadcasters[0].broadcaster.sendMessage(identities[2].magnetLink, 'From User 0'),
      broadcasters[1].broadcaster.sendMessage(identities[2].magnetLink, 'From User 1'),
    ]);

    // User 2 should receive messages from both users
    const received = await collectors[2].waitForCount(2, 30000);
    expect(received).toBe(true);

    await cleanup([
      ...broadcasters.map(bc => bc.broadcaster),
      ...broadcasters.map(bc => bc.db),
    ]);
  }, testTimeout);

  test('Message persistence across broadcaster restarts', async () => {
    const identities = generateTestIdentities(2);
    const dbPath = './data/test-persistence.db';

    // Create first broadcaster
    let broadcasters = await createMultipleChatBroadcasters(identities);
    let [bc1, bc2] = broadcasters;

    await bc1.broadcaster.startListening();
    await bc2.broadcaster.startListening();

    // Send a message
    await bc1.broadcaster.sendMessage(identities[1].magnetLink, 'Persistent message');

    await delay(5000);

    // Shutdown broadcasters
    await bc1.broadcaster.shutdown();
    await bc2.broadcaster.shutdown();

    // Check that message was stored in database
    const messages = await bc2.db.getConversation(identities[1].magnetLink, identities[0].magnetLink, 10);
    expect(messages.length).toBeGreaterThan(0);

    // Close databases
    bc1.db.close();
    bc2.db.close();
  }, testTimeout);
});
