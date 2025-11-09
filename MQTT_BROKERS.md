# MQTT Broker Configuration

This document describes the MQTT brokers used in the system and how broker failures are handled.

## Current Broker List

We currently use **6 public MQTT brokers** with no authentication required:

### Primary Brokers (Most Reliable)

1. **HiveMQ Public Broker**
   - URL: `mqtt://broker.hivemq.com:1883`
   - Features: Persistent sessions, message retention
   - Reliability: ⭐⭐⭐⭐⭐

2. **EMQX Public Broker**
   - URL: `mqtt://broker.emqx.io:1883`
   - Features: Persistent sessions, offline message queuing
   - Reliability: ⭐⭐⭐⭐⭐

3. **Mosquitto Test Broker**
   - URL: `mqtt://test.mosquitto.org:1883`
   - Features: Widely used test broker
   - Reliability: ⭐⭐⭐⭐

### Additional Brokers

4. **Bevywise Public MQTT Broker**
   - URL: `mqtt://public-mqtt-broker.bevywise.com:1883`
   - Features: No auth, no persistent storage
   - Reliability: ⭐⭐⭐

5. **Coreflux Free Public MQTT Broker**
   - URL: `mqtt://iot.coreflux.cloud:1883`
   - Features: No auth required
   - Reliability: ⭐⭐⭐

6. **Tyckr Free Public MQTT Broker**
   - URL: `mqtt://mqtt.tyckr.io:1883`
   - Features: No auth, some persistence
   - Reliability: ⭐⭐⭐

### Not Included (Requires Authentication)

**Flespi Public Broker**
- URL: `mqtt://mqtt.flespi.io:1883`
- Features: Retained messages, offline session queuing, full message storage
- Note: Requires authentication tokens
- Can be added manually via `mqttBrokers` option with credentials

## Automatic Failure Handling

The system includes **intelligent broker failure tracking** to avoid wasting time on non-working brokers:

### How It Works

1. **Detection**: When a broker connection fails or times out
2. **Cooldown**: Broker is automatically paused for a cooldown period:
   - **Connection Refused/Auth Failure**: 5 minutes
   - **Network Timeout**: 2 minutes
   - **Generic Connection Error**: 3 minutes
   - **Rate Limiting**: 30-60 seconds (depending on protocol)

3. **Skip**: During cooldown, the broker is skipped and not attempted
4. **Notify**: User is informed why certain brokers are paused
5. **Resume**: Automatically resumes trying the broker after cooldown expires

### Example Flow

```
📤 Sending message...

⏸️  Pausing MQTT broker mqtt://broker.emqx.io:1883 for 5 minutes
    (Connection failure: Connection refused)

  ℹ️  Skipping 1 rate-limited MQTT broker

Delivery status:
  ✓ MQTT (5/6 brokers)         67ms
```

Later, you'll get periodic reminders:

```
⏸️  Rate Limit Reminder:
  Some protocols/relays are paused and not being used:
  • MQTT (mqtt://broker.emqx.io:1883): 2 minutes remaining - Connection failure

[After cooldown expires]

✅ MQTT broker mqtt://broker.emqx.io:1883 is now available again
```

## Per-Broker Tracking

Each broker is tracked independently:

- **Success/Failure Rates**: Track reliability over time
- **Latency Statistics**: Monitor average/min/max latency per broker
- **Failure History**: See when brokers failed and why
- **Cooldown Status**: Check which brokers are currently paused

### View Broker Statistics

```bash
# View current status
npm run stats

# View MQTT-specific stats
npm run stats -- --protocol MQTT

# View failure history
npm run stats -- --protocol MQTT --history
```

### Example Statistics Output

```
📊 Current Rate Limit Status

MQTT (mqtt://broker.hivemq.com:1883)
────────────────────────────────────────────────────────────
  ✓ Available: Yes
  📤 Sent: 245
  ✅ Success: 243 (99.2%)
  ❌ Failed: 2
  ⚡ Avg Latency: 45ms
  📊 Range: 23ms - 156ms
  📨 Last minute: 5
  📨 Last hour: 89
  📨 Last day: 245

MQTT (mqtt://broker.emqx.io:1883)
────────────────────────────────────────────────────────────
  ✗ Available: No (in cooldown)
  📤 Sent: 67
  ✅ Success: 64 (95.5%)
  ❌ Failed: 3
  🕒 Last Failure: 2 minutes ago
  ⏳ Cooldown: 3 minutes remaining
  📨 Messages blocked during cooldown: 12
```

## Customizing Broker List

You can override the default broker list:

```typescript
import { BroadcasterWithTracking } from './src/broadcaster-with-tracking.js';

const broadcaster = new BroadcasterWithTracking(identity, db, {
  mqttEnabled: true,
  mqttBrokers: [
    'mqtt://broker.hivemq.com:1883',
    'mqtt://your-custom-broker.com:1883',
    // Add your own brokers
  ]
});
```

### Adding Authenticated Brokers

For brokers requiring authentication (like Flespi):

```typescript
import mqtt from 'mqtt';

// Connect manually with credentials
const client = mqtt.connect('mqtt://mqtt.flespi.io:1883', {
  username: 'your-token-here',
  password: '',
  clientId: `client-${Date.now()}`,
});

// Then use with broadcaster...
```

## Broker Selection Strategy

The system tries all available (non-paused) brokers in parallel:

1. **Redundancy**: If one broker fails, others continue working
2. **Speed**: Fastest broker wins (message delivered first)
3. **Reliability**: Failed brokers automatically paused
4. **Recovery**: Brokers automatically resume after cooldown

### Success Criteria

A message send is considered successful if **at least one broker** delivers it:

- Sent to 6 brokers
- 4 succeed, 2 fail
- **Result**: ✅ Success (shown as "4/6 brokers")

## Best Practices

1. **Use Multiple Brokers**: Always configure 3+ brokers for redundancy
2. **Monitor Statistics**: Regularly check `npm run stats -- --protocol MQTT`
3. **Review Failures**: Investigate brokers with high failure rates
4. **Test Periodically**: Failed brokers auto-recover, but verify manually
5. **Update List**: Remove consistently failing brokers from your config

## Troubleshooting

### Broker Always Fails

```bash
# Check specific broker status
npm run stats -- --protocol MQTT

# View failure history
npm run stats -- --protocol MQTT --history

# Manually clear cooldown to retry immediately
# (requires code modification or waiting for auto-recovery)
```

### All Brokers Failing

1. Check network connectivity
2. Verify firewall allows port 1883
3. Test brokers individually with MQTT client
4. Check broker status pages/documentation

### Authentication Errors

- Remove brokers requiring auth from default list
- Add them manually with proper credentials
- See "Adding Authenticated Brokers" section above

## Future Enhancements

- [ ] WebSocket MQTT support (ports 8000, 8080)
- [ ] TLS/SSL MQTT support (ports 8883, 8884)
- [ ] Automatic broker discovery/ranking
- [ ] Community broker performance sharing
- [ ] Geo-aware broker selection (use closest brokers)
