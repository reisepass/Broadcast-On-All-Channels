# Quick Start Guide

Get up and running with Broadcast-On-All-Channels in under 5 minutes!

## 1. Install Dependencies

```bash
# Node.js (default)
npm install

# Or use Bun for faster installation
bun install

# Deno (no install needed)
```

## 2. Run the Demo

```bash
# Node.js (default)
npm run demo

# Or use Bun
npm run bun:demo

# Or use Deno
npm run deno:demo
```

The demo will:
- Generate two test identities
- Initialize all communication channels (XMTP, Nostr, Waku, MQTT, IROH)
- Send a test message across all channels
- Show you which channels succeeded and their latencies

## 3. Start the Interactive Chat

```bash
# Node.js (default)
npm run chat

# Or use Bun
npm run bun:chat

# Or use Deno
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
# Node.js (default)
npm run test:xmtp
npm run test:nostr
npm run test:mqtt
npm run test:waku
npm run test:iroh

# Or use Bun
npm run bun:test:xmtp
npm run bun:test:nostr
# ... etc
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

### Node.js (Default)
```bash
npm run chat           # Start chat
npm run demo           # Run demo
npm run test:xmtp      # Test individual channels
```

### Bun
```bash
npm run bun:chat       # Start chat
npm run bun:demo       # Run demo
bun test              # Run unit tests (built-in test runner)
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
