# Unit Tests for Broadcast-On-All-Channels

This directory contains comprehensive unit tests for all communication channels in the multi-protocol broadcasting system.

## Test Structure

The tests are organized by protocol, with each channel having its own test file:

- **xmtp.test.ts** - Tests for XMTP (Ethereum-based encrypted messaging)
- **nostr.test.ts** - Tests for Nostr (decentralized relay-based messaging)
- **waku.test.ts** - Tests for Waku (privacy-focused P2P messaging)
- **mqtt.test.ts** - Tests for MQTT (IoT protocol with multiple brokers)
- **iroh.test.ts** - Tests for IROH (P2P with QUIC encryption)
- **integration.test.ts** - Integration tests for multi-channel broadcasting

## Running Tests

### Run All Tests
```bash
bun test
```

### Run Tests in Watch Mode
```bash
bun test:watch
```

### Run Individual Channel Tests

```bash
# XMTP tests
bun test:channels:xmtp

# Nostr tests
bun test:channels:nostr

# Waku tests
bun test:channels:waku

# MQTT tests
bun test:channels:mqtt

# IROH tests
bun test:channels:iroh
```

### Run Integration Tests
```bash
bun test:integration
```

## What Each Test Suite Covers

### XMTP Tests
- Client initialization
- Message sending and receiving
- Latency measurement
- Error handling for invalid recipients
- Sequential and concurrent message handling
- Empty and long message support

### Nostr Tests
- Relay connection and initialization
- Multi-relay broadcasting
- Encrypted direct messages (NIP-04)
- Latency measurement
- Message integrity across relays
- Minimal relay configuration

### Waku Tests
- P2P node initialization
- Peer discovery
- Light push protocol
- Content topic handling
- Privacy-focused communication
- Long message support

### MQTT Tests
- Multi-broker connections
- QoS level 1 (at least once delivery)
- Message retention
- Topic naming conventions
- Broker fallback mechanism
- Concurrent message handling

### IROH Tests
- Ed25519 key-based identity
- QUIC protocol encryption
- Bidirectional stream communication
- Direct P2P connections
- Relay fallback support
- Custom ALPN protocol

### Integration Tests
- Simultaneous multi-channel broadcasting
- Redundancy and fallback mechanisms
- Partial failure handling
- Latency comparison across channels
- Identity consistency
- Selective channel enabling

## Test Design Principles

1. **Isolation**: Each test file only enables the channel being tested
2. **No Side Effects**: Tests don't modify existing code, only import and test it
3. **Real Connections**: Tests use actual protocol implementations (not mocks)
4. **Comprehensive Coverage**: Tests cover success cases, error handling, and edge cases
5. **Performance Metrics**: Tests measure and validate latency

## Important Notes

- **Network Dependency**: Tests require internet connectivity as they use real protocols
- **Timeout Considerations**: P2P protocols (Waku, IROH) may take longer to connect
- **Test Data**: Tests use generated identities and don't persist data
- **Parallel Execution**: Tests can be run in parallel but may affect latency measurements

## Test Execution Times

Approximate execution times (may vary based on network conditions):

- XMTP: ~30-60 seconds
- Nostr: ~20-40 seconds
- Waku: ~60-120 seconds (P2P connection time)
- MQTT: ~15-30 seconds
- IROH: ~30-90 seconds (P2P connection time)
- Integration: ~60-180 seconds (all channels)

## Troubleshooting

### Tests Timeout
- Increase timeout values in test configuration
- Check internet connectivity
- Verify protocol service availability (relays, brokers, etc.)

### P2P Tests Fail (Waku, IROH)
- P2P protocols may fail if nodes can't discover peers
- Tests are designed to handle this gracefully
- Check if you're behind a restrictive firewall

### MQTT Tests Fail
- Public MQTT brokers may be temporarily unavailable
- Tests use fallback mechanism with multiple brokers
- At least one broker should succeed

### XMTP Tests Fail
- Ensure you're using 'dev' environment for testing
- Check if XMTP infrastructure is available
- Database files will be created in project root

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Include both success and failure cases
3. Add appropriate timeout values
4. Document any special requirements
5. Update this README with new test information
