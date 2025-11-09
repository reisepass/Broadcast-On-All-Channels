/**
 * Database Schema with Drizzle ORM
 *
 * Comprehensive tracking of:
 * - Messages and receipts
 * - Protocol/relay performance
 * - Rate limiting events
 * - Time-windowed message counts for rate limit analysis
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Messages table - stores all sent/received messages
 */
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull().unique(),
  fromIdentity: text('from_identity').notNull(),
  toIdentity: text('to_identity').notNull(),
  content: text('content').notNull(),
  timestamp: integer('timestamp').notNull(), // Message creation time
  isAcknowledgment: integer('is_acknowledgment', { mode: 'boolean' }).notNull().default(false),
  firstReceivedProtocol: text('first_received_protocol'),
  firstReceivedAt: integer('first_received_at'),
}, (table) => ({
  uuidIdx: index('idx_messages_uuid').on(table.uuid),
  fromIdx: index('idx_messages_from').on(table.fromIdentity),
  toIdx: index('idx_messages_to').on(table.toIdentity),
  timestampIdx: index('idx_messages_timestamp').on(table.timestamp),
}));

/**
 * Message receipts - tracks delivery on each protocol/relay
 */
export const messageReceipts = sqliteTable('message_receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageUuid: text('message_uuid').notNull(),
  protocol: text('protocol').notNull(),
  relay: text('relay'), // For protocols with multiple relays (Nostr, MQTT)
  receivedAt: integer('received_at').notNull(),
  latencyMs: integer('latency_ms').notNull(),
}, (table) => ({
  uuidIdx: index('idx_receipts_uuid').on(table.messageUuid),
  protocolIdx: index('idx_receipts_protocol').on(table.protocol),
  receivedAtIdx: index('idx_receipts_received_at').on(table.receivedAt),
}));

/**
 * Message send log - detailed log of every send attempt
 * Used for rate limit analysis (messages per minute/hour/day)
 */
export const messageSendLog = sqliteTable('message_send_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageUuid: text('message_uuid').notNull(),
  protocol: text('protocol').notNull(),
  relay: text('relay'), // Relay URL for multi-relay protocols
  sentAt: integer('sent_at').notNull(), // Actual send timestamp
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorType: text('error_type'), // 'rate_limit', 'network', 'timeout', etc.
  errorMessage: text('error_message'),
  latencyMs: integer('latency_ms'),
}, (table) => ({
  protocolSentAtIdx: index('idx_send_log_protocol_sent_at').on(table.protocol, table.sentAt),
  relaySentAtIdx: index('idx_send_log_relay_sent_at').on(table.relay, table.sentAt),
  errorTypeIdx: index('idx_send_log_error_type').on(table.errorType),
  sentAtIdx: index('idx_send_log_sent_at').on(table.sentAt),
}));

/**
 * Rate limit events - tracks when we get rate limited
 */
export const rateLimitEvents = sqliteTable('rate_limit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  protocol: text('protocol').notNull(),
  relay: text('relay'), // Relay URL if applicable
  occurredAt: integer('occurred_at').notNull(),
  errorMessage: text('error_message'),
  messagesInLastMinute: integer('messages_in_last_minute'),
  messagesInLastHour: integer('messages_in_last_hour'),
  messagesInLastDay: integer('messages_in_last_day'),
  // Cooldown period (how long until we retry)
  cooldownUntil: integer('cooldown_until'),
}, (table) => ({
  protocolOccurredIdx: index('idx_rate_limit_protocol_occurred').on(table.protocol, table.occurredAt),
  relayOccurredIdx: index('idx_rate_limit_relay_occurred').on(table.relay, table.occurredAt),
  cooldownIdx: index('idx_rate_limit_cooldown').on(table.cooldownUntil),
}));

/**
 * Protocol/relay performance metrics
 */
export const protocolPerformance = sqliteTable('protocol_performance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  protocol: text('protocol').notNull(),
  relay: text('relay'), // NULL for single-endpoint protocols

  // Counters
  totalSent: integer('total_sent').notNull().default(0),
  totalSuccess: integer('total_success').notNull().default(0),
  totalFailed: integer('total_failed').notNull().default(0),
  totalRateLimited: integer('total_rate_limited').notNull().default(0),

  // Latency stats (in milliseconds)
  avgLatencyMs: integer('avg_latency_ms'),
  minLatencyMs: integer('min_latency_ms'),
  maxLatencyMs: integer('max_latency_ms'),

  // Acknowledgment tracking (for received messages)
  totalAcked: integer('total_acked').notNull().default(0),

  // Timestamps
  firstUsedAt: integer('first_used_at'),
  lastUsedAt: integer('last_used_at'),
  lastSuccessAt: integer('last_success_at'),
  lastFailureAt: integer('last_failure_at'),
  lastRateLimitAt: integer('last_rate_limit_at'),

  // Availability
  isCurrentlyAvailable: integer('is_currently_available', { mode: 'boolean' }).notNull().default(true),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
}, (table) => ({
  protocolRelayUnique: uniqueIndex('idx_perf_protocol_relay').on(table.protocol, table.relay),
  lastUsedIdx: index('idx_perf_last_used').on(table.lastUsedAt),
  availabilityIdx: index('idx_perf_availability').on(table.isCurrentlyAvailable),
}));

/**
 * Channel preferences (per identity)
 */
export const channelPreferences = sqliteTable('channel_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  identity: text('identity').notNull(),
  protocol: text('protocol').notNull(),
  relay: text('relay'), // For protocols with multiple relays

  isWorking: integer('is_working', { mode: 'boolean' }).notNull().default(true),
  lastAckAt: integer('last_ack_at'),
  avgLatencyMs: integer('avg_latency_ms'),
  preferenceOrder: integer('preference_order'), // User's stated preference
  cannotUse: integer('cannot_use', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  identityProtocolRelayUnique: uniqueIndex('idx_prefs_identity_protocol_relay').on(
    table.identity,
    table.protocol,
    table.relay
  ),
  identityIdx: index('idx_prefs_identity').on(table.identity),
}));

/**
 * Performance sharing - exportable performance data for community sharing
 */
export const performanceSnapshots = sqliteTable('performance_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotAt: integer('snapshot_at').notNull(),
  protocol: text('protocol').notNull(),
  relay: text('relay'),

  // Performance data at snapshot time
  successRate: integer('success_rate'), // Percentage (0-100)
  avgLatencyMs: integer('avg_latency_ms'),
  sampleSize: integer('sample_size'), // Number of messages in sample

  // Geographic/network info (optional, anonymized)
  region: text('region'), // e.g., 'us-west', 'eu-central'

  // For sharing/exporting
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  sharedAt: integer('shared_at'),
}, (table) => ({
  snapshotIdx: index('idx_snapshots_snapshot_at').on(table.snapshotAt),
  protocolRelayIdx: index('idx_snapshots_protocol_relay').on(table.protocol, table.relay),
  sharedIdx: index('idx_snapshots_shared').on(table.isShared),
}));

// Type exports for TypeScript
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type MessageReceipt = typeof messageReceipts.$inferSelect;
export type NewMessageReceipt = typeof messageReceipts.$inferInsert;

export type MessageSendLog = typeof messageSendLog.$inferSelect;
export type NewMessageSendLog = typeof messageSendLog.$inferInsert;

export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type NewRateLimitEvent = typeof rateLimitEvents.$inferInsert;

export type ProtocolPerformance = typeof protocolPerformance.$inferSelect;
export type NewProtocolPerformance = typeof protocolPerformance.$inferInsert;

export type ChannelPreference = typeof channelPreferences.$inferSelect;
export type NewChannelPreference = typeof channelPreferences.$inferInsert;

export type PerformanceSnapshot = typeof performanceSnapshots.$inferSelect;
export type NewPerformanceSnapshot = typeof performanceSnapshots.$inferInsert;
