# Quick Start Guide

Get up and running with Broadcast On All Channels in 5 minutes.

## Prerequisites

- [Bun](https://bun.sh) installed (or Node.js v18+)
- Internet connection

## Installation

```bash
# Clone or navigate to the project
cd Broadcast-On-All-Channels

# Install dependencies
bun install
```

## Run the Demo

```bash
# Run the complete system demo
bun run demo
```

This will:
1. Generate two test identities
2. Initialize all protocol clients
3. Send a message from User 1 to User 2
4. Show which protocols succeeded

## Test Individual Protocols

Want to test each protocol separately?

```bash
# Test XMTP (using public servers)
bun run test:xmtp

# Test Nostr (using public relays)
bun run test:nostr

# Test Waku (P2P network)
bun run test:waku

# Test MQTT (using public brokers)
bun run test:mqtt

# Test IROH (conceptual demo)
bun run test:iroh
```

## Basic Usage

### 1. Generate Your Identity

```typescript
import { generateIdentity, displayIdentity } from './src/identity.js';

const myIdentity = generateIdentity();
displayIdentity(myIdentity);

// Save your identity somewhere safe!
console.log('My magnet link:', myIdentity.magnetLink);
```

**Important:** Your identity contains private keys. Store it securely!

### 2. Share Your Magnet Link

Give your magnet link to others so they can message you:

```
magnet:?xt=urn:identity:v1&secp256k1pub=abc123...&ed25519pub=def456...&eth=0x789...
```

This magnet link contains:
- Your public keys (safe to share)
- NO private keys (kept secret)

### 3. Send a Message

```typescript
import { Broadcaster } from './src/broadcaster.js';

const broadcaster = new Broadcaster(myIdentity);
await broadcaster.initialize();

// Send to someone's magnet link
const results = await broadcaster.broadcast(
  'magnet:?xt=urn:identity:v1&...',  // Their magnet link
  'Hello from the broadcast system!'
);

// Check what worked
results.forEach(result => {
  if (result.success) {
    console.log(`✅ ${result.protocol} (${result.latencyMs}ms)`);
  } else {
    console.log(`❌ ${result.protocol} failed`);
  }
});

await broadcaster.shutdown();
```

## Understanding the Output

When you run the demo, you'll see:

```
✅ XMTP V3 (1234ms)
✅ Nostr (567ms)
✅ Waku (890ms)
❌ MQTT failed
```

This means:
- Message sent successfully via XMTP, Nostr, and Waku
- MQTT failed (but message still delivered via others!)
- Numbers show latency in milliseconds

## Common Issues

### "Failed to connect to relay"
- Nostr relays are public and sometimes unreliable
- The system tries multiple relays - at least one should work

### "XMTP initialization failed"
- Check your internet connection
- The dev environment may have rate limits
- Try again in a few minutes

### "Waku peers not found"
- Waku is a P2P network - finding peers takes time
- Wait 30-60 seconds and try again
- Bootstrap nodes may be temporarily unavailable

### "MQTT connection timeout"
- Public MQTT brokers can be unreliable
- Try a different broker (see README for list)
- Other protocols will still work!

## What's Happening?

When you broadcast a message:

1. **XMTP**: Connects to XMTP's servers, sends encrypted message
2. **Nostr**: Publishes to multiple relay servers, encrypted DM
3. **Waku**: Sends via P2P network to content topic
4. **MQTT**: Publishes to broker topic path

The recipient can receive from ANY of these channels.

## Next Steps

- Read [README.md](./README.md) for full documentation
- Check [SUMMARY.md](./SUMMARY.md) for architecture overview
- See [XMTP_UPGRADE.md](./XMTP_UPGRADE.md) for XMTP details
- Explore the code in `src/` and `examples/`

## Tips

1. **Start Simple**: Run `bun run demo` first
2. **Test Individually**: Try each protocol separately to understand them
3. **Check Latency**: Some protocols are faster than others
4. **Multiple Channels**: Even if one fails, others keep working
5. **Experiment**: Modify the examples to learn how it works

## Help

If something's not working:

1. Check your internet connection
2. Make sure dependencies installed: `bun install`
3. Try individual protocol tests to isolate issues
4. Check the error messages - they're usually helpful
5. Open an issue on GitHub

## Philosophy

> "Don't choose which network to trust. Trust them all. If one fails, the others succeed."

This is the core idea: redundancy through diversity.

Happy broadcasting! 📡
