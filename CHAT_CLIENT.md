# Multi-Protocol Chat Client

A robust CLI chat client that broadcasts messages across multiple decentralized protocols with automatic acknowledgments and channel preference learning.

## Features

### ✅ Core Features
- **Multi-Protocol Broadcasting** - Sends every message across all available channels
- **Automatic Acknowledgments** - Receives confirmation when messages are delivered
- **Message Deduplication** - Same message received on multiple channels shows only once
- **Channel Learning** - Learns which protocols work best for each contact
- **Channel Preferences** - Users can specify preferred protocols and custom servers
- **SQLite Storage** - All messages and preferences stored locally
- **Color-Coded Output** - Easy to distinguish sent/received messages
- **Latency Tracking** - Shows delivery time for each protocol

### 🔒 Robust Design
- **No Acknowledgment of Acknowledgments** - Prevents infinite loops
- **Multi-Channel Redundancy** - If one protocol fails, others succeed
- **Offline Memory** - Remembers which channels work for each contact
- **Graceful Degradation** - Works even if some protocols are unavailable

## Quick Start

### Start the Chat Client

```bash
bun run chat
```

### First Run

On first run, the client will:
1. Generate a new identity (secp256k1 + Ed25519 keypairs)
2. Save it to `./data/my-identity.json`
3. Display your magnet link
4. Connect to all available protocols
5. Start listening for messages

### Share Your Magnet Link

Copy your magnet link and share it with others:
```
magnet:?xt=urn%3Aidentity%3Av1&secp256k1pub=04...&ed25519pub=...&eth=0x...
```

## Usage

### Start a Chat

```
Command: /chat magnet:?xt=urn%3Aidentity%3Av1&secp256k1pub=...
```

### Send Messages

Once in chat mode, just type and press Enter:
```
You: Hello! Testing the multi-protocol chat system!
```

### See Delivery Status

After sending, you'll see checkmarks for each protocol:
```
Delivery status:
  ✓ nostr (3 relays)         269ms
  ✓ XMTP V3                  1450ms
  ✓ MQTT (3/3 brokers)       ~TBD
```

### Receive Messages

When someone sends you a message:
```
Them: Hey! Got your message!
  First received via: nostr
  Also received:
    • XMTP V3 (+523ms)
    • MQTT (+120ms)
```

## Commands

| Command | Description |
|---------|-------------|
| `/chat <magnet-link>` | Start chatting with someone |
| `/history` | Show conversation history |
| `/status` | Show protocol performance stats |
| `/quit` | Exit the client |

## How It Works

### Message Flow

1. **Sending**
   ```
   You type message
   → Generate UUID
   → Serialize as JSON
   → Broadcast to all protocols
   → Save to SQLite
   → Display delivery status
   ```

2. **Receiving**
   ```
   Message arrives on protocol A
   → Decrypt/deserialize
   → Check UUID (deduplicate)
   → Save to SQLite
   → Send acknowledgment
   → Display message

   Same message arrives on protocol B
   → Check UUID (already seen!)
   → Just record receipt time
   → Show "+Xms" delta
   ```

3. **Acknowledgments**
   ```
   Receive message
   → Create acknowledgment
   → Include channel preferences
   → Broadcast on all protocols
   → Update local channel stats

   Receive acknowledgment
   → Show checkmark
   → Update channel preferences
   → Learn which channels work
   → NO acknowledgment of ack!
   ```

## Message Format

### Regular Message
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "message",
  "content": "Hello!",
  "timestamp": 1699564800000,
  "fromMagnetLink": "magnet:?..."
}
```

### Acknowledgment Message
```json
{
  "uuid": "650e8400-e29b-41d4-a716-446655440001",
  "type": "acknowledgment",
  "content": "ACK: 550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1699564801000,
  "fromMagnetLink": "magnet:?...",
  "originalMessageUuid": "550e8400-e29b-41d4-a716-446655440000",
  "receivedAt": 1699564801000,
  "receivedVia": "nostr",
  "channelPreferences": [
    {
      "protocol": "nostr",
      "preferenceOrder": 1,
      "cannotUse": false
    },
    {
      "protocol": "mqtt",
      "preferenceOrder": 2,
      "cannotUse": false,
      "customEndpoint": "mqtt://my-server.com:1883"
    }
  ]
}
```

## Database Schema

### messages
Stores all sent and received messages
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  from_identity TEXT NOT NULL,
  to_identity TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  is_acknowledgment INTEGER NOT NULL,
  first_received_protocol TEXT,
  first_received_at INTEGER
)
```

### message_receipts
Tracks when each message was received on each protocol
```sql
CREATE TABLE message_receipts (
  id INTEGER PRIMARY KEY,
  message_uuid TEXT NOT NULL,
  protocol TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL
)
```

### channel_preferences
Learns which channels work for each contact
```sql
CREATE TABLE channel_preferences (
  id INTEGER PRIMARY KEY,
  identity TEXT NOT NULL,
  protocol TEXT NOT NULL,
  is_working INTEGER NOT NULL,
  last_ack_at INTEGER,
  avg_latency_ms INTEGER,
  preference_order INTEGER,
  cannot_use INTEGER NOT NULL,
  UNIQUE(identity, protocol)
)
```

### protocol_performance
Overall stats for each protocol
```sql
CREATE TABLE protocol_performance (
  protocol TEXT PRIMARY KEY,
  total_sent INTEGER NOT NULL,
  total_acked INTEGER NOT NULL,
  avg_latency_ms INTEGER,
  last_used_at INTEGER
)
```

## Channel Preference Learning

### Automatic Learning
Every time you receive an acknowledgment:
1. Mark that channel as "working" for that contact
2. Record the latency
3. Update average latency
4. Remember last successful use

### Manual Preferences
Contacts can specify preferences in their acknowledgments:
- **preferenceOrder** - Which channels they prefer (1 = best)
- **cannotUse** - Which channels they can't use
- **customEndpoint** - Their own servers for faster delivery

### Smart Sending
Future enhancement: Use learned preferences to try fastest channels first

## File Structure

```
data/
├── my-identity.json       # Your identity (keep secret!)
└── chat.db               # SQLite database

src/
├── cli.ts                # Main CLI interface
├── chat-broadcaster.ts   # Broadcasting with receiving
├── database.ts           # SQLite operations
├── message-types.ts      # Message format definitions
├── broadcaster.ts        # Core multi-protocol broadcaster
└── identity.ts           # Identity generation
```

## Example Session

```bash
$ bun run chat

═══════════════════════════════════════════════════════════
  Multi-Protocol Chat Client
═══════════════════════════════════════════════════════════

🔑 Creating new identity...
✅ Identity saved to ./data/my-identity.json

Your Identity:

secp256k1 (XMTP, Nostr, Waku, MQTT):
  Ethereum Address: 0x1234567890abcdef...

Ed25519 (IROH):
  Node ID: a1b2c3d4e5f6...

📎 Your Magnet Link (share this):
magnet:?xt=urn%3Aidentity%3Av1&secp256k1pub=04...&eth=0x...

🚀 Connecting to protocols...

✅ Nostr initialized (3 relays)
✅ Connected and listening for messages

💬 Interactive Chat Mode

Commands:
  /chat <magnet-link> - Start chatting with someone
  /history - Show conversation history
  /status - Show protocol status
  /quit - Exit

Command: /chat magnet:?xt=urn%3Aidentity%3Av1&...
✅ Now chatting with: magnet:?xt=urn%3Aidentity%3Av1...
Type your messages and press Enter to send

You: Hello! Testing the chat!

📤 Sending...
Delivery status:
  ✓ nostr (3 relays)         245ms
  ✓ XMTP V3                  1450ms

Them: Hi! I got your message!
  First received via: nostr

  ✓ Acknowledged via nostr (+180ms)

You: Great! It's working!
```

## Currently Supported Protocols

| Protocol | Status | Notes |
|----------|--------|-------|
| Nostr | ✅ Working | 3 public relays |
| XMTP V3 | ✅ Working | MLS encryption, dev environment |
| MQTT | ⏳ Integrated | 3 public brokers (HiveMQ, EMQX, Mosquitto) - pending testing |
| Waku | ❌ Disabled | Dependency issues |
| IROH | ❌ Conceptual | Requires Rust integration |

## Troubleshooting

### "Failed to decode identity"
- Make sure the magnet link is complete and correctly copied
- Check that it starts with `magnet:?xt=urn%3Aidentity%3Av1`

### "Not receiving messages"
- Make sure both parties are connected to at least one common protocol
- Check `/status` to see which protocols are working
- Try sending a test message to yourself first

### "All protocols failed"
- Check your internet connection
- Some protocols may be temporarily unavailable
- Try restarting the client

## Security Notes

- **Keep `my-identity.json` secure** - It contains your private keys
- **Backup your identity** - You can't recover messages without it
- **Magnet links are safe to share** - They only contain public keys
- **Messages are encrypted** - On protocols that support it (Nostr, XMTP)

## Future Enhancements

- [ ] Smart channel selection based on learned preferences
- [ ] Retry failed sends on alternative channels
- [ ] Message queue for offline recipients
- [ ] Group chat support
- [ ] File transfer
- [ ] Voice/video call coordination
- [ ] Desktop notifications
- [ ] Web UI
- [ ] Mobile app

## Contributing

This is part of the Broadcast-On-All-Channels project. See main README.md for details.
