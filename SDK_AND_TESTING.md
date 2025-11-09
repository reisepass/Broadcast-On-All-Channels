# SDK Package and Multi-User Testing

## Overview

This document describes the SDK package and multi-user testing infrastructure created to reduce code duplication and enable comprehensive testing scenarios.

## SDK Package Structure

### Location: `src/sdk/`

The SDK consolidates common functionality used across:
- CLI tools (`npm run chat`, `npm run identity`)
- Demo scripts (`npm run demo`, `npm run demo:latency`)
- Test scripts (`npm run test:continuous`, protocol tests)

### Modules

#### 1. `stats.ts` - Statistics Tracking

Shared protocol performance statistics used by all monitoring tools.

**Exports:**
```typescript
interface ProtocolStats {
  sent: number;
  received: number;
  totalLatency: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  lastReceived?: number;
}

interface UserStats {
  name: string;
  protocols: Map<string, ProtocolStats>;
  totalSent: number;
  totalReceived: number;
  startTime?: number;
  lastMessageReceived?: number;
}

// Functions
normalizeProtocolName(protocol: string): string
createUserStats(name: string): UserStats
getProtocolStats(stats: UserStats, protocol: string): ProtocolStats
updateReceivedStats(stats: UserStats, protocol: string, latencyMs: number): void
updateSentStats(stats: UserStats, protocol: string): void
getSortedProtocols(stats: UserStats): Array<[string, ProtocolStats]>
formatUptime(startTime: number): string
```

**Usage Example:**
```typescript
import { createUserStats, updateReceivedStats } from './sdk/stats.js';

const stats = createUserStats('Alice');
updateReceivedStats(stats, 'XMTP', 250); // 250ms latency
```

#### 2. `broadcaster-factory.ts` - Broadcaster Creation

Factory functions for creating broadcasters with common configurations.

**Exports:**
```typescript
getDefaultBroadcasterOptions(): BroadcasterOptions
createBroadcaster(identity: UnifiedIdentity, options?: Partial<BroadcasterOptions>): Promise<Broadcaster>
createChatBroadcaster(identity: UnifiedIdentity, dbPath?: string, options?: Partial<BroadcasterOptions>): Promise<{broadcaster, db}>
createMultipleBroadcasters(identities: UnifiedIdentity[], options?: Partial<BroadcasterOptions>): Promise<Broadcaster[]>
createMultipleChatBroadcasters(identities: UnifiedIdentity[], options?: Partial<BroadcasterOptions>): Promise<Array<{broadcaster, db}>>
```

**Usage Example:**
```typescript
import { createBroadcaster } from './sdk/broadcaster-factory.js';

const broadcaster = await createBroadcaster(myIdentity);
// Broadcaster is initialized and ready to use
```

#### 3. `test-helpers.ts` - Test Utilities

Utilities for multi-user testing scenarios.

**Exports:**
```typescript
generateTestIdentities(count: number, prefix?: string): UnifiedIdentity[]
createTestMessage(content: string, from?: string): string
waitFor(condition: () => boolean | Promise<boolean>, timeoutMs?: number, checkIntervalMs?: number): Promise<boolean>
waitForMessages(messages: ChatMessage[], expectedCount: number, timeoutMs?: number): Promise<boolean>
delay(ms: number): Promise<void>
randomString(length?: number): string
randomMessage(): string
cleanup(resources: Array<{shutdown?: () => Promise<void>, close?: () => void}>): Promise<void>

class MessageCollector {
  collect(message: ChatMessage, protocol: string): void
  getMessages(): ChatMessage[]
  getCount(): number
  getProtocolCounts(): Map<string, number>
  clear(): void
  hasMessage(predicate: (msg: ChatMessage) => boolean): boolean
  waitForCount(count: number, timeoutMs?: number): Promise<boolean>
}
```

**Usage Example:**
```typescript
import { generateTestIdentities, MessageCollector, cleanup } from './sdk/test-helpers.js';

const identities = generateTestIdentities(3);
const collector = new MessageCollector();

broadcaster.onMessage((msg, protocol) => collector.collect(msg, protocol));
await collector.waitForCount(5, 30000); // Wait for 5 messages
```

## Multi-User Tests

### Location: `tests/multi-user.test.ts`

Comprehensive integration tests for multi-user scenarios.

### Test Suite

#### 1. **Two-User Bidirectional Communication**
Tests basic message exchange between two users.

```bash
npm run test:multi-user
```

**What it tests:**
- User A sends to User B
- User B sends to User A
- Both users receive messages
- At least one protocol works

#### 2. **Three-User Group Conversation**
Tests communication patterns in a small group.

**What it tests:**
- User A broadcasts to Users B and C
- User B broadcasts to User C
- All messages are received correctly
- Group message routing works

#### 3. **Multi-Protocol Delivery**
Verifies message delivery across all protocols.

**What it tests:**
- Message is sent via all enabled protocols
- Tracks which protocols successfully delivered
- Logs protocol success rates

#### 4. **Protocol Performance Statistics**
Tests statistics tracking during communication.

**What it tests:**
- Statistics are correctly tracked per protocol
- Latency measurements are accurate
- Min/max/average calculations work

#### 5. **Concurrent Message Sending**
Tests simultaneous sends from multiple users.

**What it tests:**
- Multiple users send to one recipient simultaneously
- All messages are received
- No message loss during concurrent sends

#### 6. **Message Persistence**
Tests database persistence across restarts.

**What it tests:**
- Messages are saved to database
- Conversation history is retrievable
- Data survives broadcaster shutdown

## Code Duplication Eliminated

### Before SDK

**Duplicated Code:**
- `ProtocolStats` interface (3 locations)
- `UserStats` interface (3 locations)
- `normalizeProtocolName()` (3 locations)
- Statistics tracking logic (3 locations)
- Broadcaster initialization patterns (multiple locations)

**Total Duplicated Lines:** ~150 lines

### After SDK

All common code is in `src/sdk/` and imported where needed.

**Affected Files:**
- ✅ `examples/continuous-test.ts` - now uses SDK
- ✅ `examples/live-latency-demo.ts` - now uses SDK
- ✅ `tests/multi-user.test.ts` - uses SDK from start

**Lines Saved:** ~100 lines

## Usage Examples

### Creating a Multi-User Test

```typescript
import { generateTestIdentities, MessageCollector, cleanup } from '../src/sdk/test-helpers.js';
import { createMultipleChatBroadcasters } from '../src/sdk/broadcaster-factory.js';
import { createUserStats, updateReceivedStats } from '../src/sdk/stats.js';

test('Custom multi-user scenario', async () => {
  // Create 5 test users
  const identities = generateTestIdentities(5);
  const broadcasters = await createMultipleChatBroadcasters(identities);

  // Set up message collection
  const collectors = broadcasters.map(() => new MessageCollector());

  broadcasters.forEach((bc, index) => {
    bc.broadcaster.onMessage((msg, protocol) => {
      collectors[index].collect(msg, protocol);
    });
  });

  // Start all listeners
  await Promise.all(broadcasters.map(bc => bc.broadcaster.startListening()));

  // User 0 broadcasts to everyone
  for (let i = 1; i < 5; i++) {
    await broadcasters[0].broadcaster.sendMessage(
      identities[i].magnetLink,
      `Message to User ${i}`
    );
  }

  // Wait for all messages
  for (let i = 1; i < 5; i++) {
    const received = await collectors[i].waitForCount(1, 30000);
    expect(received).toBe(true);
  }

  // Cleanup
  await cleanup([
    ...broadcasters.map(bc => bc.broadcaster),
    ...broadcasters.map(bc => bc.db),
  ]);
}, 60000);
```

### Using Statistics Tracking

```typescript
import { createUserStats, updateReceivedStats, getSortedProtocols } from '../src/sdk/stats.js';

const stats = createUserStats('Alice');

broadcaster.onMessage((msg, protocol) => {
  const latency = Date.now() - msg.timestamp;
  updateReceivedStats(stats, protocol, latency);
});

// Later: display sorted by speed
const sorted = getSortedProtocols(stats);
for (const [protocol, pstats] of sorted) {
  console.log(`${protocol}: avg ${pstats.avgLatency}ms`);
}
```

## Running Tests

### Single Protocol Tests
```bash
npm run test:xmtp       # Test XMTP only
npm run test:nostr      # Test Nostr only
npm run test:mqtt       # Test MQTT only
npm run test:waku       # Test Waku only
npm run test:iroh       # Test IROH only
```

### Multi-User Integration Tests
```bash
npm run test:multi-user  # Run all multi-user scenarios
```

### Continuous Testing
```bash
npm run test:continuous -- -r "RECIPIENT_MAGNET_LINK"
```

## Best Practices

### 1. **Always Use SDK for Common Functionality**

❌ **Don't:**
```typescript
// Duplicating code
interface ProtocolStats {
  sent: number;
  received: number;
  // ...
}
```

✅ **Do:**
```typescript
import { ProtocolStats } from '../src/sdk/stats.js';
```

### 2. **Use Factory Functions**

❌ **Don't:**
```typescript
const broadcaster = new Broadcaster(identity, {
  xmtpEnabled: true,
  nostrEnabled: true,
  // ... repeat configuration
});
await broadcaster.initialize();
```

✅ **Do:**
```typescript
const broadcaster = await createBroadcaster(identity);
```

### 3. **Use Test Helpers for Waiting**

❌ **Don't:**
```typescript
await new Promise(resolve => setTimeout(resolve, 10000)); // Hope it arrives
```

✅ **Do:**
```typescript
await collector.waitForCount(1, 30000); // Wait up to 30s for message
```

### 4. **Always Cleanup in Tests**

❌ **Don't:**
```typescript
test('my test', async () => {
  const broadcaster = await createBroadcaster(identity);
  // ... test code
  // No cleanup - resources leak!
});
```

✅ **Do:**
```typescript
test('my test', async () => {
  const broadcaster = await createBroadcaster(identity);
  // ... test code
  await cleanup([broadcaster]);
});
```

## Future Enhancements

1. **Add More Test Scenarios:**
   - Message ordering tests
   - Protocol failure recovery tests
   - Network partition tests
   - Load testing (100+ users)

2. **SDK Extensions:**
   - Performance benchmarking utilities
   - Mock protocol implementations for testing
   - Test data generators

3. **Documentation:**
   - Add JSDoc comments to all SDK functions
   - Create API reference documentation
   - Add more usage examples

## Summary

The SDK package provides:
- ✅ Reduced code duplication (~100 lines saved)
- ✅ Consistent statistics tracking across all tools
- ✅ Easy broadcaster creation with sensible defaults
- ✅ Comprehensive test utilities for multi-user scenarios
- ✅ 6 multi-user integration tests covering key scenarios
- ✅ Reusable components for future development

All demos and tests now use the SDK, making the codebase more maintainable and easier to extend.
