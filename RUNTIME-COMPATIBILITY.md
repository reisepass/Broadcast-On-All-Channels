# Runtime Compatibility Guide

This project supports multiple JavaScript runtimes with automatic runtime detection.

## Runtime Support Matrix

| Protocol | Bun | Node.js | Deno | Notes |
|----------|-----|---------|------|-------|
| **Nostr** | ✅ | ✅ | ✅ | Works everywhere |
| **Waku** | ✅ | ✅ | ✅ | Works everywhere |
| **MQTT** | ✅ | ✅ | ✅ | Works everywhere |
| **IROH** | ✅ | ✅ | ✅ | Works everywhere |
| **XMTP** | ❌ | ✅ | ✅ | **Bun incompatible** |

## XMTP + Bun Compatibility Issue

### Why XMTP doesn't work with Bun

**XMTP uses native Rust bindings** via Node-API (N-API) for:
- Database encryption/decryption
- Message signing/verification
- Cryptographic operations

**The Issue:**
When XMTP's native code tries to read TypedArray data from JavaScript:

1. **Node.js**: Correctly passes TypedArray metadata to native code ✅
2. **Deno**: Has good Node-API compatibility ✅
3. **Bun**: Has a different FFI implementation that doesn't match Node-API expectations ❌

**Error Message:**
```
error: Get TypedArray info failed
 code: "InvalidArg"
```

This happens because Bun's FFI is optimized differently and isn't 100% compatible with all Node-API native modules.

### Solution: Auto-Detection

The broadcaster **automatically detects the runtime** and:
- ✅ **Enables XMTP** on Node.js or Deno
- ❌ **Disables XMTP** on Bun (4 protocols instead of 5)

## Running with Different Runtimes

### 1. Bun (Default - Fast, but no XMTP)

```bash
bun run demo
```

**Result:** 4 protocols (Nostr, Waku, MQTT, IROH)

### 2. Node.js (Full support with XMTP)

```bash
# Install dependencies
npm install

# Run demo
npm run demo
# or
node --loader ts-node/esm examples/full-broadcast-demo.ts
```

**Result:** 5 protocols (XMTP, Nostr, Waku, MQTT, IROH)

### 3. Deno (Full support with XMTP)

```bash
# Run demo with Node compatibility mode
deno run --allow-all --node-modules-dir examples/full-broadcast-demo.ts
```

**Result:** 5 protocols (XMTP, Nostr, Waku, MQTT, IROH)

## How Runtime Detection Works

The code automatically detects the runtime:

```typescript
import { supportsXMTP, detectRuntime } from './src/runtime.js';

// Auto-enable XMTP only on compatible runtimes
const broadcasterOptions = {
  xmtpEnabled: supportsXMTP(), // true on Node.js/Deno, false on Bun
  nostrEnabled: true,
  wakuEnabled: true,
  mqttEnabled: true,
  irohEnabled: true,
};
```

## Development Notes

- **For production**: Use Node.js if you need all 5 protocols
- **For testing**: Bun is faster for development with 4 protocols
- **For Deno users**: Full compatibility with all protocols

## Checking Your Runtime

When you run the demo, it will display:

```
🔧 Runtime: Bun
   XMTP Support: ❌
   Note: XMTP native bindings require Node.js or Deno
```

Or:

```
🔧 Runtime: Node.js
   XMTP Support: ✅
```

## Future Compatibility

This issue may be resolved if:
1. Bun improves Node-API compatibility
2. XMTP provides a Bun-native binding
3. XMTP switches to a pure JavaScript implementation

For now, the automatic runtime detection ensures the best experience across all runtimes.
