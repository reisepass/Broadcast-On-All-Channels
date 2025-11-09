# Rate Limiting & Performance Tracking

This system includes comprehensive rate limiting detection, performance tracking, and **intelligent cooldown management** for all protocols.

## Features

- **Automatic Rate Limit Detection**: Detects rate limiting from all protocols (XMTP, Nostr, MQTT, Waku, IROH)
- **Intelligent Cooldown Management**: Automatically pauses rate-limited protocols/relays/nodes
- **Periodic User Notifications**: Reminds users why certain protocols are paused
- **Time-Windowed Message Counts**: Track messages sent per minute/hour/day
- **Protocol Performance Metrics**: Success rates, latency stats, availability
- **Rate Limit History**: See when rate limits occurred and how many messages triggered them
- **Performance Snapshots**: Export and share performance data with the community
- **Per-Relay/Node Tracking**: Track individual relays (Nostr) and brokers (MQTT) separately

## Database Schema

The system uses **Drizzle ORM** with **libSQL** for structured data management and migrations.

### Tables

1. **`messages`**: All sent/received messages with UUIDs
2. **`message_receipts`**: Delivery tracking per protocol/relay
3. **`message_send_log`**: Detailed log of every send attempt (for rate limit analysis)
4. **`rate_limit_events`**: Records when rate limiting occurs
5. **`protocol_performance`**: Aggregate performance metrics per protocol/relay
6. **`channel_preferences`**: Per-user channel preferences
7. **`performance_snapshots`**: Exportable performance data for sharing

## Usage

### View Rate Limiting Stats

```bash
# View current status for all protocols
npm run stats

# View status for a specific protocol
npm run stats -- --protocol Nostr

# View rate limit event history
npm run stats -- --history

# View history for a specific protocol
npm run stats -- --protocol MQTT --history

# View stats for a specific user
npm run stats -- --user happy-blue-falcon

# Export performance data
npm run stats -- --export
```

### Using in Code

```typescript
import { ChatDatabase } from './src/db/database.js';
import { BroadcasterWithTracking } from './src/broadcaster-with-tracking.js';
import { SmartBroadcaster } from './src/broadcaster-smart.js';

// Create database
const db = await ChatDatabase.create('./data/chat.db');

// Create broadcaster with tracking and cooldown management
const broadcaster = new BroadcasterWithTracking(identity, db, options);

// Send a message (automatically handles cooldowns)
const results = await broadcaster.broadcast(recipientMagnetLink, 'Hello!');

// Check if a protocol is rate limited
const isLimited = await broadcaster.isRateLimited('Nostr');

// Check a specific relay
const isRelayLimited = broadcaster.shouldSkipDueToCooldown('Nostr', 'wss://relay.damus.io');

// Get active cooldowns
const cooldowns = broadcaster.getActiveCooldowns();
console.log(`Active cooldowns: ${cooldowns.length}`);

for (const cooldown of cooldowns) {
  console.log(`${cooldown.protocol}${cooldown.relay ? ` (${cooldown.relay})` : ''}`);
  console.log(`  Cooldown until: ${new Date(cooldown.cooldownUntil).toLocaleString()}`);
  console.log(`  Reason: ${cooldown.reason}`);
}

// Manually clear a cooldown (if you want to retry immediately)
broadcaster.clearCooldown('XMTP');

// Get detailed rate limit info from database
const info = await broadcaster.getRateLimitInfo('Nostr');
console.log(`Messages in last minute: ${info.messagesInLastMinute}`);
console.log(`Messages in last hour: ${info.messagesInLastHour}`);
console.log(`Messages in last day: ${info.messagesInLastDay}`);

// Get the rate limit manager for advanced control
const rateLimitManager = broadcaster.getRateLimitManager();

// Manually set a cooldown
rateLimitManager.setCooldown('TestProtocol', null, 60000, 'Testing cooldown');

// Filter available relays
const allNostrRelays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const availableRelays = rateLimitManager.filterAvailableRelays('Nostr', allNostrRelays);
console.log(`Available Nostr relays: ${availableRelays.length}/${allNostrRelays.length}`);

// Get performance metrics
const metrics = await broadcaster.getPerformanceMetrics('XMTP');

// Create performance snapshot
await broadcaster.createPerformanceSnapshot('us-west');

// Shutdown broadcaster (stops periodic notifications)
await broadcaster.shutdown();
```

### Using SmartBroadcaster (Advanced)

The `SmartBroadcaster` class provides additional relay filtering:

```typescript
import { SmartBroadcaster } from './src/broadcaster-smart.js';

const broadcaster = new SmartBroadcaster(identity, db, options);

// Automatically filters relays before sending
await broadcaster.broadcast(recipientMagnetLink, 'Hello!');

// Get availability info for each protocol
const nostrStatus = broadcaster.getAvailableRelayCount('Nostr');
console.log(`Nostr: ${nostrStatus.available}/${nostrStatus.total} relays available`);

// Get full protocol status summary
const summary = broadcaster.getProtocolStatusSummary();
console.log(summary);
// Output:
// 📊 Protocol Status Summary:
//   ✓ XMTP: Available
//   ✓ Nostr: 2/3 available
//   ✗ MQTT: All rate-limited
//   ✓ Waku: Available
//   ✓ IROH: Available
```

## Rate Limit Detection

The system automatically detects rate limiting from error messages:

### XMTP
- `rate limit`
- `too many requests`
- HTTP 429 status

### Nostr
- `rate limit` / `rate-limit`
- `too fast`
- `slow down`
- `blocked` / `restricted`

### MQTT
- `quota`
- `throttle`
- `connection limit`

### Generic
- HTTP 429 with `Retry-After` header parsing

## Cooldown Management

### How It Works

When a rate limit is detected, the system automatically:

1. **Pauses the Protocol/Relay**: Immediately stops sending to the rate-limited endpoint
2. **Notifies the User**: Shows a message like:
   ```
   ⏸️  Pausing Nostr relay wss://relay.damus.io for 30 seconds (Rate limit detected)
   ```
3. **Sets a Cooldown Timer**: Tracks when the endpoint will be available again
4. **Skips During Cooldown**: Won't attempt to send via that endpoint until cooldown expires
5. **Periodic Reminders**: Every 5 minutes, reminds you which endpoints are still paused:
   ```
   ⏸️  Rate Limit Reminder:
     Some protocols/relays are paused due to rate limiting and not being used:
     • Nostr (wss://relay.damus.io): 2 minutes remaining - Rate limit detected
   ```
6. **Auto-Resume**: When cooldown expires, automatically resumes using that endpoint:
   ```
   ✅ Nostr relay wss://relay.damus.io is now available again
   ```

### Cooldown Periods

When rate limited, the system applies these default cooldown periods:

- **XMTP**: 60 seconds
- **Nostr**: 30 seconds (per relay)
- **MQTT**: 60 seconds (per broker)
- **Waku**: 60 seconds
- **IROH**: 60 seconds
- **Generic**: Extracted from `Retry-After` header or 60 seconds default

### Per-Relay/Node Intelligence

For protocols with multiple endpoints:

- **Nostr**: Each relay is tracked separately. If `wss://relay.damus.io` is rate-limited, the system continues using `wss://nos.lol` and `wss://relay.nostr.band`
- **MQTT**: Each broker is tracked separately. If `broker.hivemq.com` is rate-limited, messages still go through `broker.emqx.io` and `test.mosquitto.org`

### Example Flow

```
📤 Sending message...

  ℹ️  Skipping 1 rate-limited Nostr relay
  ℹ️  Skipping rate-limited protocol: XMTP

Delivery status:
  ✓ Nostr (2 relays)          234ms
  ✓ MQTT (3/3 brokers)         67ms
  ✓ Waku                       156ms
  ✗ XMTP V3                    Failed (in cooldown)

⏸️  Active Rate Limit Cooldowns:
  • XMTP: 45 seconds remaining
  • Nostr (wss://relay.damus.io): 15 seconds remaining
```

## Performance Metrics

For each protocol/relay, the system tracks:

- **Counters**:
  - Total messages sent
  - Total successful
  - Total failed
  - Total rate limited
  - Total acknowledged

- **Latency Stats**:
  - Average latency
  - Minimum latency
  - Maximum latency

- **Availability**:
  - Currently available (yes/no)
  - Consecutive failures
  - Last success timestamp
  - Last failure timestamp
  - Last rate limit timestamp

## Message Count Queries

Query messages sent in time windows:

```typescript
// Get messages sent in last minute/hour/day
const counts = await db.getMessageCountsByTimeWindow('Nostr', null);
console.log(`Last minute: ${counts.minute}`);
console.log(`Last hour: ${counts.hour}`);
console.log(`Last day: ${counts.day}`);

// For specific relay
const relayCount = await db.getMessagesSentInWindow(
  'Nostr',
  'wss://relay.damus.io',
  60 * 1000  // last minute
);
```

## Sharing Performance Data

Export performance snapshots to share with the community:

```typescript
// Create snapshot
const snapshots = await db.createPerformanceSnapshot('us-west');

// Export shared data
const exportData = await db.exportSharedPerformanceData();

// Save to file
fs.writeFileSync('performance.json', JSON.stringify(exportData, null, 2));
```

This helps the community identify:
- Which protocols/relays are most reliable
- Geographic performance differences
- Rate limit thresholds
- Best practices for avoiding rate limits

## Database Migrations

Using Drizzle Kit for schema migrations:

```bash
# Generate migration
pnpm drizzle-kit generate

# Apply migration
pnpm drizzle-kit push

# View current schema
pnpm drizzle-kit introspect
```

## Example Output

```
═══════════════════════════════════════════════════════════
  Rate Limiting & Performance Statistics
═══════════════════════════════════════════════════════════

📊 Current Rate Limit Status

Nostr (3 relays)
────────────────────────────────────────────────────────────
  ✓ Available: Yes
  📤 Sent: 156
  ✅ Success: 152 (97.4%)
  ❌ Failed: 4
  🚫 Rate Limited: 2
  ⚡ Avg Latency: 234ms
  📊 Range: 45ms - 1203ms
  🕒 Last Rate Limited: 2 hours ago
  📨 Last minute: 3
  📨 Last hour: 45
  📨 Last day: 156

MQTT (2/3 brokers)
────────────────────────────────────────────────────────────
  ✓ Available: Yes
  📤 Sent: 89
  ✅ Success: 89 (100.0%)
  ⚡ Avg Latency: 67ms
  📨 Last minute: 2
  📨 Last hour: 23
  📨 Last day: 89
```

## Notes

- Message counts are indexed for fast querying
- WAL mode enabled for concurrent access
- 10-second busy timeout prevents lock errors
- All timestamps in milliseconds since epoch
- Rate limit events stored with message counts at time of event
