# XMTP Package Upgrade Guide

## What Changed

The deprecated `@xmtp/xmtp-js` package has been replaced with `@xmtp/node-sdk` (v3).

### Key Differences

#### Old (v2 - deprecated):
```typescript
import { Client } from '@xmtp/xmtp-js';
import { Wallet } from 'ethers';

const wallet = Wallet.createRandom();
const client = await Client.create(wallet, { env: 'production' });
const conversation = await client.conversations.newConversation(recipientAddress);
await conversation.send('Hello');
```

#### New (v3 - current):
```typescript
import { Client } from '@xmtp/node-sdk';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const client = await Client.create(account.address, { env: 'dev' });
await client.registerIdentity();
const conversation = await client.conversations.newConversation([recipientAddress]);
await conversation.send('Hello');
```

## Major Changes

### 1. **Wallet/Account Handling**
- **Old**: Used `ethers.Wallet`
- **New**: Uses `viem` accounts

### 2. **Client Creation**
- **Old**: `Client.create(wallet, options)`
- **New**: `Client.create(address, options)` + `client.registerIdentity()`

### 3. **Conversation Creation**
- **Old**: `newConversation(address)`
- **New**: `newConversation([address])` - Takes an array

### 4. **Message Retrieval**
- **New**: Requires explicit syncing with `conversation.sync()` before fetching messages

### 5. **Encryption Protocol**
- **Old**: Custom XMTP encryption
- **New**: MLS (Messaging Layer Security) - industry standard

### 6. **Environment**
- The v3 SDK uses 'dev' or 'production' environments
- Development is recommended for testing

## Migration Steps

1. **Update package.json**:
   ```json
   {
     "dependencies": {
       "@xmtp/node-sdk": "^0.0.47",
       "viem": "^2.0.0"
     }
   }
   ```

2. **Update imports**:
   ```typescript
   // Remove
   import { Client } from '@xmtp/xmtp-js';
   import { Wallet } from 'ethers';

   // Add
   import { Client } from '@xmtp/node-sdk';
   import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
   ```

3. **Update identity generation** (see `src/identity.ts`)

4. **Update client initialization** (see `src/broadcaster.ts`)

## Files Updated

- ✅ `package.json` - Updated dependencies
- ✅ `src/identity.ts` - Changed from ethers to viem
- ✅ `src/broadcaster.ts` - Updated XMTP initialization and sending
- ✅ `examples/xmtp-test.ts` - Complete rewrite for v3 SDK

## Benefits of v3

- **MLS Protocol**: Industry-standard encryption (used by major messaging apps)
- **Better Performance**: More efficient message handling
- **Active Development**: v2 is deprecated, v3 is actively maintained
- **Group Messaging**: Better support for group conversations
- **Modern Stack**: Built on viem instead of ethers

## Important Notes

### You Don't Need to Run a Node!

Despite the name `@xmtp/node-sdk`, this is **NOT** a full node. It's a lightweight client SDK that:
- ✅ Connects to XMTP's public network infrastructure
- ✅ Uses XMTP's hosted servers
- ✅ Only stores minimal local data (message cache)
- ✅ Works like any other messaging client

The "node" in the name refers to Node.js (the JavaScript runtime), not a blockchain node.

## Known Limitations

- Some v3 features may still be in development
- Development environment recommended for testing
- Creates local database files for conversation storage (lightweight)

## Resources

- [XMTP v3 Documentation](https://docs.xmtp.org/)
- [Node SDK GitHub](https://github.com/xmtp/xmtp-node-js-sdk)
- [Migration Guide](https://docs.xmtp.org/build/installation)
