# Quick Start Guide

Get up and running with Broadcast-On-All-Channels in under 5 minutes!

## 1. Install Dependencies

Choose your runtime:

```bash
# Bun (recommended - fastest)
bun install

# Node.js
npm install

# Deno (no install needed)
```

## 2. Run the Demo

```bash
# Bun
bun run demo

# Node.js
npm run node:demo

# Deno
npm run deno:demo
```

The demo will:
- Generate two test identities
- Initialize all communication channels (XMTP, Nostr, Waku, MQTT, IROH)
- Send a test message across all channels
- Show you which channels succeeded and their latencies

## 3. Start the Interactive Chat

```bash
# Bun
bun run chat

# Node.js
npm run node:chat

# Deno
npm run deno:chat
```

The chat will:
1. Create your identity (or load existing one)
2. Connect to all available channels
3. Wait for you to paste a recipient's magnet link
4. Let you send messages that broadcast across all channels
5. Show delivery confirmations with latencies

## 4. Test Individual Channels

```bash
# Test XMTP
bun run test:xmtp

# Test Nostr
bun run test:nostr

# Test MQTT
bun run test:mqtt

# Test Waku
bun run test:waku

# Test IROH
bun run test:iroh
```

## 5. Run Unit Tests

```bash
# All tests
bun test

# Individual channel
bun test:channels:xmtp

# Integration tests
bun test:integration
```

## Command Cheat Sheet

### Bun (Recommended)
```bash
bun run chat           # Start chat
bun run demo           # Run demo
bun test              # Run tests
```

### Node.js
```bash
npm run node:chat      # Start chat
npm run node:demo      # Run demo
```

### Deno
```bash
npm run deno:chat      # Start chat
npm run deno:demo      # Run demo
```

## Supported Protocols

The system supports 5 different communication protocols:

1. **XMTP** - Ethereum-based encrypted messaging
2. **Nostr** - Decentralized relay network
3. **Waku** - Privacy-focused P2P messaging
4. **MQTT** - IoT protocol with multiple public brokers
5. **IROH** - Direct P2P with QUIC encryption

All protocols run in parallel for maximum reliability!

## Common Issues

### "Cannot find module"
```bash
# Reinstall dependencies
bun install
# or
npm install
```

### "Permission denied" (Deno)
```bash
# Add --allow-all flag (already in scripts)
deno run --allow-all --unstable src/cli.ts
```

### "Connection timeout"
- Check your internet connection
- Some P2P protocols (Waku, IROH) may take longer to connect
- Try running the demo first to test all channels

## Next Steps

1. Read `RUNTIMES.md` for detailed runtime comparison
2. Check `tests/README.md` for testing documentation
3. Review `README.md` for architecture details
4. Explore the example files in `examples/` directory

## Need Help?

- Check the documentation in the project root
- Run examples to see each protocol in action
- Review test files to understand the API

Happy broadcasting! 🚀
