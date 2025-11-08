# Multi-Runtime Support

This project supports running with **Bun**, **Node.js**, and **Deno**. Each runtime has its own advantages and trade-offs.

## Prerequisites

### Node.js (Default)
```bash
# Install Node.js 20+ from https://nodejs.org
npm install  # Install dependencies including tsx
```

### Bun
```bash
curl -fsSL https://bun.sh/install | bash
bun install
```

### Deno
```bash
curl -fsSL https://deno.land/install.sh | sh
```

## Available Commands

### Default Commands (Node.js with tsx)

```bash
# Main applications
npm run chat          # Interactive chat client
npm run demo          # Full broadcast demo

# Protocol examples
npm run test:xmtp
npm run test:nostr
npm run test:iroh
npm run test:waku
npm run test:mqtt

# Unit tests (use Bun)
bun test                      # Run all tests
bun test:watch               # Watch mode
bun test:channels:xmtp       # Individual channel tests
bun test:channels:nostr
bun test:channels:waku
bun test:channels:mqtt
bun test:channels:iroh
bun test:integration         # Integration tests
```

### Bun Commands

```bash
# Main applications
npm run bun:chat      # Interactive chat client
npm run bun:demo      # Full broadcast demo

# Protocol examples
npm run bun:test:xmtp
npm run bun:test:nostr
npm run bun:test:iroh
npm run bun:test:waku
npm run bun:test:mqtt

# Unit tests (Bun's built-in test runner)
bun test                      # Run all tests
bun test:watch               # Watch mode
bun test:channels:xmtp       # Individual channel tests
```

### Node.js Commands (explicit)

```bash
# Same as default, but explicit
npm run node:chat
npm run node:demo
npm run node:test:xmtp
npm run node:test:nostr
npm run node:test:iroh
npm run node:test:waku
npm run node:test:mqtt
```

### Deno Commands

```bash
# Main applications
npm run deno:chat     # Interactive chat client
npm run deno:demo     # Full broadcast demo

# Protocol examples
npm run deno:test:xmtp
npm run deno:test:nostr
npm run deno:test:iroh
npm run deno:test:waku
npm run deno:test:mqtt
```

## Runtime Comparison

| Feature | Node.js | Bun | Deno |
|---------|---------|-----|------|
| TypeScript Support | ✅ Via tsx | ✅ Native | ✅ Native |
| Installation Speed | ⚠️ Moderate | ✅ Very Fast | ✅ Fast |
| Startup Time | ⚠️ Moderate | ✅ Very Fast | ✅ Fast |
| npm Package Support | ✅ Full | ✅ Full | ⚠️ Most packages |
| Built-in Test Runner | ❌ No (needs jest/mocha) | ✅ Yes | ✅ Yes |
| Native APIs | ✅ Node | ✅ Web + Node | ✅ Web |
| Maturity | ✅ Very Mature | ⚠️ Newer | ✅ Mature |
| Production Ready | ✅ Yes | ⚠️ Beta | ✅ Yes |

## Runtime-Specific Notes

### Node.js (Default)
- **Best for production**: Most mature ecosystem
- Uses `tsx` for fast TypeScript execution
- Full npm package compatibility
- Industry standard for backend applications
- Default runtime for this project

### Bun
- **Best for development**: Fastest startup, native TypeScript, built-in test runner
- Native SQLite support
- Compatible with most Node.js packages
- Hot reload support
- Great for local development and testing

### Deno
- **Best for security**: Permission-based security model
- Native TypeScript and Web API support
- Requires `--allow-all` flag for full functionality
- Some npm packages may have compatibility issues
- Good alternative runtime

## Installation

### First Time Setup

```bash
# For Bun (recommended)
bun install

# For Node.js
npm install

# For Deno (no install needed, fetches on first run)
# Dependencies are cached automatically
```

## Troubleshooting

### Node.js: "Cannot find module tsx"
```bash
npm install tsx --save-dev
```

### Deno: Permission Errors
Add specific permissions instead of `--allow-all`:
```bash
deno run --allow-net --allow-read --allow-write --allow-env src/cli.ts
```

### Bun: Package Compatibility Issues
Most npm packages work with Bun, but if you encounter issues:
```bash
bun install --backend=npm  # Use npm install behavior
```

### All Runtimes: Native Module Issues
Some packages (like `@number0/iroh`) may require native builds:
```bash
# Bun
bun rebuild

# Node.js
npm rebuild

# Deno
# Native modules may have limited support
```

## Performance Benchmarks

Approximate startup times (may vary by system):

```
┌─────────────┬──────────────┬───────────────┐
│ Runtime     │ First Run    │ Subsequent    │
├─────────────┼──────────────┼───────────────┤
│ Bun         │ ~100ms       │ ~50ms         │
│ Node.js     │ ~500ms       │ ~300ms        │
│ Deno        │ ~200ms       │ ~100ms        │
└─────────────┴──────────────┴───────────────┘
```

## Which Runtime Should I Use?

**Choose Node.js if:**
- You're deploying to production (default choice)
- You need maximum package compatibility
- You want the most mature and stable ecosystem
- Your deployment environment requires Node.js

**Choose Bun if:**
- You want the fastest development experience
- You're developing and testing frequently
- You want built-in TypeScript and test support
- You need faster iteration cycles

**Choose Deno if:**
- You prefer secure-by-default execution
- You want modern web standards
- You're comfortable with occasional package compatibility issues

## Examples

### Run the demo with all runtimes

```bash
# Node.js (default)
npm run demo

# Bun
npm run bun:demo

# Deno
npm run deno:demo
```

### Start the interactive chat

```bash
# Node.js (default)
npm run chat

# Bun
npm run bun:chat

# Deno
npm run deno:chat
```

## Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Node.js Documentation](https://nodejs.org/docs)
- [Deno Documentation](https://deno.land/manual)
- [tsx Documentation](https://github.com/esbuild-kit/tsx)
