/**
 * Enhanced Chat Database with Drizzle ORM
 *
 * Features:
 * - Full rate limiting tracking
 * - Time-windowed message counts (minute/hour/day)
 * - Protocol/relay performance metrics
 * - Performance snapshot sharing
 */

import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq, and, gte, sql, desc, isNull } from 'drizzle-orm';
import { createClient, type Client } from '@libsql/client';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import * as schema from './schema.js';

export type {
  Message,
  NewMessage,
  MessageReceipt,
  NewMessageReceipt,
  MessageSendLog,
  NewMessageSendLog,
  RateLimitEvent,
  NewRateLimitEvent,
  ProtocolPerformance,
  NewProtocolPerformance,
  ChannelPreference,
  NewChannelPreference,
  PerformanceSnapshot,
  NewPerformanceSnapshot,
} from './schema.js';

export interface TimeWindow {
  minute: number;
  hour: number;
  day: number;
}

export interface RateLimitInfo {
  isRateLimited: boolean;
  cooldownUntil?: number;
  messagesInLastMinute: number;
  messagesInLastHour: number;
  messagesInLastDay: number;
}

export class ChatDatabase {
  private client: Client;
  private db: LibSQLDatabase<typeof schema>;

  private constructor(dbPath: string, client: Client) {
    this.client = client;
    this.db = drizzle(this.client, { schema });
  }

  static async create(dbPath: string = './data/chat.db'): Promise<ChatDatabase> {
    // Ensure data directory exists
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Initialize libSQL client
    const client = createClient({
      url: `file:${dbPath}`,
    });

    const db = new ChatDatabase(dbPath, client);

    // Run migrations
    await db.runMigrations();

    return db;
  }

  private async runMigrations() {
    // Create tables if they don't exist
    // Drizzle doesn't auto-migrate, so we'll use raw SQL for now
    // In production, you'd use drizzle-kit push or generate migrations

    // Enable WAL mode and set busy timeout
    await this.client.execute('PRAGMA journal_mode = WAL');
    await this.client.execute('PRAGMA busy_timeout = 10000');

    // First, create new tables
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        from_identity TEXT NOT NULL,
        to_identity TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        is_acknowledgment INTEGER NOT NULL DEFAULT 0,
        first_received_protocol TEXT,
        first_received_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_messages_uuid ON messages(uuid);
      CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_identity);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_identity);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

      CREATE TABLE IF NOT EXISTS message_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_uuid TEXT NOT NULL,
        protocol TEXT NOT NULL,
        relay TEXT,
        received_at INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_receipts_uuid ON message_receipts(message_uuid);
      CREATE INDEX IF NOT EXISTS idx_receipts_protocol ON message_receipts(protocol);
      CREATE INDEX IF NOT EXISTS idx_receipts_received_at ON message_receipts(received_at);

      CREATE TABLE IF NOT EXISTS message_send_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_uuid TEXT NOT NULL,
        protocol TEXT NOT NULL,
        relay TEXT,
        sent_at INTEGER NOT NULL,
        success INTEGER NOT NULL,
        error_type TEXT,
        error_message TEXT,
        latency_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_send_log_protocol_sent_at ON message_send_log(protocol, sent_at);
      CREATE INDEX IF NOT EXISTS idx_send_log_relay_sent_at ON message_send_log(relay, sent_at);
      CREATE INDEX IF NOT EXISTS idx_send_log_error_type ON message_send_log(error_type);
      CREATE INDEX IF NOT EXISTS idx_send_log_sent_at ON message_send_log(sent_at);

      CREATE TABLE IF NOT EXISTS rate_limit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        protocol TEXT NOT NULL,
        relay TEXT,
        occurred_at INTEGER NOT NULL,
        error_message TEXT,
        messages_in_last_minute INTEGER,
        messages_in_last_hour INTEGER,
        messages_in_last_day INTEGER,
        cooldown_until INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_rate_limit_protocol_occurred ON rate_limit_events(protocol, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_relay_occurred ON rate_limit_events(relay, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_cooldown ON rate_limit_events(cooldown_until);

      CREATE TABLE IF NOT EXISTS protocol_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        protocol TEXT NOT NULL,
        relay TEXT,
        total_sent INTEGER NOT NULL DEFAULT 0,
        total_success INTEGER NOT NULL DEFAULT 0,
        total_failed INTEGER NOT NULL DEFAULT 0,
        total_rate_limited INTEGER NOT NULL DEFAULT 0,
        avg_latency_ms INTEGER,
        min_latency_ms INTEGER,
        max_latency_ms INTEGER,
        total_acked INTEGER NOT NULL DEFAULT 0,
        first_used_at INTEGER,
        last_used_at INTEGER,
        last_success_at INTEGER,
        last_failure_at INTEGER,
        last_rate_limit_at INTEGER,
        is_currently_available INTEGER NOT NULL DEFAULT 1,
        consecutive_failures INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS channel_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identity TEXT NOT NULL,
        protocol TEXT NOT NULL,
        relay TEXT,
        is_working INTEGER NOT NULL DEFAULT 1,
        last_ack_at INTEGER,
        avg_latency_ms INTEGER,
        preference_order INTEGER,
        cannot_use INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_prefs_identity ON channel_preferences(identity);

      CREATE TABLE IF NOT EXISTS performance_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_at INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        relay TEXT,
        success_rate INTEGER,
        avg_latency_ms INTEGER,
        sample_size INTEGER,
        region TEXT,
        is_shared INTEGER NOT NULL DEFAULT 0,
        shared_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_snapshot_at ON performance_snapshots(snapshot_at);
      CREATE INDEX IF NOT EXISTS idx_snapshots_protocol_relay ON performance_snapshots(protocol, relay);
      CREATE INDEX IF NOT EXISTS idx_snapshots_shared ON performance_snapshots(is_shared);
    `);

    // Migrate existing tables to add missing columns (safe to run multiple times)
    await this.migrateExistingTables();
  }

  private async migrateExistingTables() {
    // Add missing columns to existing tables
    // SQLite doesn't support "IF NOT EXISTS" for columns, so we try/catch

    const alterCommands = [
      // Add relay column to message_receipts
      'ALTER TABLE message_receipts ADD COLUMN relay TEXT',

      // Add id and relay columns to protocol_performance
      'ALTER TABLE protocol_performance ADD COLUMN id INTEGER',
      'ALTER TABLE protocol_performance ADD COLUMN relay TEXT',

      // Add new performance tracking columns
      'ALTER TABLE protocol_performance ADD COLUMN total_success INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE protocol_performance ADD COLUMN total_failed INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE protocol_performance ADD COLUMN total_rate_limited INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE protocol_performance ADD COLUMN min_latency_ms INTEGER',
      'ALTER TABLE protocol_performance ADD COLUMN max_latency_ms INTEGER',
      'ALTER TABLE protocol_performance ADD COLUMN first_used_at INTEGER',
      'ALTER TABLE protocol_performance ADD COLUMN last_success_at INTEGER',
      'ALTER TABLE protocol_performance ADD COLUMN last_failure_at INTEGER',
      'ALTER TABLE protocol_performance ADD COLUMN last_rate_limit_at INTEGER',
      'ALTER TABLE protocol_performance ADD COLUMN is_currently_available INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE protocol_performance ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0',

      // Add relay column to channel_preferences
      'ALTER TABLE channel_preferences ADD COLUMN relay TEXT',
    ];

    for (const cmd of alterCommands) {
      try {
        await this.client.execute(cmd);
      } catch (error: any) {
        // Ignore "duplicate column" errors
        if (!error.message?.includes('duplicate column')) {
          // Log other errors but don't fail
          // console.warn('Migration warning:', error.message);
        }
      }
    }

    // Drop and recreate indexes that need updating
    try {
      await this.client.execute('DROP INDEX IF EXISTS idx_perf_protocol_relay');
      await this.client.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_protocol_relay ON protocol_performance(protocol, relay)'
      );

      await this.client.execute('DROP INDEX IF EXISTS idx_prefs_identity_protocol_relay');
      await this.client.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_prefs_identity_protocol_relay ON channel_preferences(identity, protocol, relay)'
      );

      // Create indexes on new columns
      await this.client.execute(
        'CREATE INDEX IF NOT EXISTS idx_perf_last_used ON protocol_performance(last_used_at)'
      );
      await this.client.execute(
        'CREATE INDEX IF NOT EXISTS idx_perf_availability ON protocol_performance(is_currently_available)'
      );
    } catch (error: any) {
      // Ignore index errors
    }
  }

  // ============================================================
  // MESSAGE OPERATIONS
  // ============================================================

  async saveMessage(message: schema.NewMessage) {
    return this.db.insert(schema.messages).values(message).onConflictDoNothing();
  }

  async getMessage(uuid: string) {
    const results = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.uuid, uuid))
      .limit(1);

    return results[0];
  }

  async getConversation(identity1: string, identity2: string, limit: number = 50) {
    const results = await this.db
      .select()
      .from(schema.messages)
      .where(
        sql`(from_identity = ${identity1} AND to_identity = ${identity2})
            OR (from_identity = ${identity2} AND to_identity = ${identity1})`
      )
      .orderBy(desc(schema.messages.timestamp))
      .limit(limit);

    return results.reverse();
  }

  // ============================================================
  // MESSAGE SEND LOGGING (for rate limit analysis)
  // ============================================================

  async logMessageSend(log: schema.NewMessageSendLog) {
    return this.db.insert(schema.messageSendLog).values(log);
  }

  async getMessagesSentInWindow(
    protocol: string,
    relay: string | null,
    windowMs: number
  ): Promise<number> {
    const cutoffTime = Date.now() - windowMs;

    const conditions = [
      eq(schema.messageSendLog.protocol, protocol),
      gte(schema.messageSendLog.sentAt, cutoffTime),
    ];

    if (relay) {
      conditions.push(eq(schema.messageSendLog.relay, relay));
    } else {
      conditions.push(isNull(schema.messageSendLog.relay));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.messageSendLog)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  async getMessageCountsByTimeWindow(
    protocol: string,
    relay: string | null = null
  ): Promise<TimeWindow> {
    const minute = await this.getMessagesSentInWindow(protocol, relay, 60 * 1000);
    const hour = await this.getMessagesSentInWindow(protocol, relay, 60 * 60 * 1000);
    const day = await this.getMessagesSentInWindow(protocol, relay, 24 * 60 * 60 * 1000);

    return { minute, hour, day };
  }

  // ============================================================
  // RATE LIMIT TRACKING
  // ============================================================

  async recordRateLimitEvent(event: Omit<schema.NewRateLimitEvent, 'occurredAt'>) {
    const now = Date.now();

    // Get current message counts
    const counts = await this.getMessageCountsByTimeWindow(event.protocol, event.relay || null);

    return this.db.insert(schema.rateLimitEvents).values({
      ...event,
      occurredAt: now,
      messagesInLastMinute: counts.minute,
      messagesInLastHour: counts.hour,
      messagesInLastDay: counts.day,
    });
  }

  async checkRateLimitStatus(
    protocol: string,
    relay: string | null = null
  ): Promise<RateLimitInfo> {
    const now = Date.now();

    const conditions = [
      eq(schema.rateLimitEvents.protocol, protocol),
      gte(schema.rateLimitEvents.cooldownUntil, now),
    ];

    if (relay) {
      conditions.push(eq(schema.rateLimitEvents.relay, relay));
    } else {
      conditions.push(isNull(schema.rateLimitEvents.relay));
    }

    const recentEvent = await this.db
      .select()
      .from(schema.rateLimitEvents)
      .where(and(...conditions))
      .orderBy(desc(schema.rateLimitEvents.occurredAt))
      .limit(1);

    const counts = await this.getMessageCountsByTimeWindow(protocol, relay);

    if (recentEvent.length > 0) {
      return {
        isRateLimited: true,
        cooldownUntil: recentEvent[0].cooldownUntil || undefined,
        messagesInLastMinute: counts.minute,
        messagesInLastHour: counts.hour,
        messagesInLastDay: counts.day,
      };
    }

    return {
      isRateLimited: false,
      messagesInLastMinute: counts.minute,
      messagesInLastHour: counts.hour,
      messagesInLastDay: counts.day,
    };
  }

  async getRateLimitHistory(protocol: string, relay: string | null = null, limit: number = 10) {
    const conditions = [eq(schema.rateLimitEvents.protocol, protocol)];

    if (relay) {
      conditions.push(eq(schema.rateLimitEvents.relay, relay));
    } else {
      conditions.push(isNull(schema.rateLimitEvents.relay));
    }

    return this.db
      .select()
      .from(schema.rateLimitEvents)
      .where(and(...conditions))
      .orderBy(desc(schema.rateLimitEvents.occurredAt))
      .limit(limit);
  }

  // ============================================================
  // PROTOCOL PERFORMANCE TRACKING
  // ============================================================

  async updateProtocolPerformance(
    protocol: string,
    relay: string | null,
    update: {
      success: boolean;
      latencyMs?: number;
      errorType?: string;
      isRateLimited?: boolean;
    }
  ) {
    const now = Date.now();

    // Get existing record
    const conditions = [eq(schema.protocolPerformance.protocol, protocol)];
    if (relay) {
      conditions.push(eq(schema.protocolPerformance.relay, relay));
    } else {
      conditions.push(isNull(schema.protocolPerformance.relay));
    }

    const existing = await this.db
      .select()
      .from(schema.protocolPerformance)
      .where(and(...conditions))
      .limit(1);

    const baseData = {
      protocol,
      relay,
      totalSent: 1,
      totalSuccess: update.success ? 1 : 0,
      totalFailed: update.success ? 0 : 1,
      totalRateLimited: update.isRateLimited ? 1 : 0,
      firstUsedAt: now,
      lastUsedAt: now,
    };

    if (existing.length === 0) {
      // Insert new record
      return this.db.insert(schema.protocolPerformance).values({
        ...baseData,
        avgLatencyMs: update.latencyMs,
        minLatencyMs: update.latencyMs,
        maxLatencyMs: update.latencyMs,
        lastSuccessAt: update.success ? now : null,
        lastFailureAt: update.success ? null : now,
        lastRateLimitAt: update.isRateLimited ? now : null,
        isCurrentlyAvailable: update.success,
        consecutiveFailures: update.success ? 0 : 1,
      });
    }

    // Update existing record
    const current = existing[0];

    const newAvgLatency =
      update.latencyMs && current.avgLatencyMs
        ? Math.round((current.avgLatencyMs + update.latencyMs) / 2)
        : update.latencyMs || current.avgLatencyMs;

    const newMinLatency =
      update.latencyMs && current.minLatencyMs
        ? Math.min(current.minLatencyMs, update.latencyMs)
        : update.latencyMs || current.minLatencyMs;

    const newMaxLatency =
      update.latencyMs && current.maxLatencyMs
        ? Math.max(current.maxLatencyMs, update.latencyMs)
        : update.latencyMs || current.maxLatencyMs;

    return this.db
      .update(schema.protocolPerformance)
      .set({
        totalSent: current.totalSent + 1,
        totalSuccess: current.totalSuccess + (update.success ? 1 : 0),
        totalFailed: current.totalFailed + (update.success ? 0 : 1),
        totalRateLimited: current.totalRateLimited + (update.isRateLimited ? 1 : 0),
        avgLatencyMs: newAvgLatency,
        minLatencyMs: newMinLatency,
        maxLatencyMs: newMaxLatency,
        lastUsedAt: now,
        lastSuccessAt: update.success ? now : current.lastSuccessAt,
        lastFailureAt: update.success ? current.lastFailureAt : now,
        lastRateLimitAt: update.isRateLimited ? now : current.lastRateLimitAt,
        isCurrentlyAvailable: update.success,
        consecutiveFailures: update.success ? 0 : current.consecutiveFailures + 1,
      })
      .where(and(...conditions));
  }

  async getProtocolPerformance(protocol?: string, relay?: string | null) {
    let query = this.db.select().from(schema.protocolPerformance);

    const conditions = [];
    if (protocol) {
      conditions.push(eq(schema.protocolPerformance.protocol, protocol));
    }
    if (relay !== undefined) {
      if (relay) {
        conditions.push(eq(schema.protocolPerformance.relay, relay));
      } else {
        conditions.push(isNull(schema.protocolPerformance.relay));
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(schema.protocolPerformance.lastUsedAt));
  }

  // ============================================================
  // PERFORMANCE SNAPSHOTS & SHARING
  // ============================================================

  async createPerformanceSnapshot(region?: string) {
    const now = Date.now();
    const performances = await this.getProtocolPerformance();

    const snapshots: schema.NewPerformanceSnapshot[] = performances.map((perf) => ({
      snapshotAt: now,
      protocol: perf.protocol,
      relay: perf.relay,
      successRate:
        perf.totalSent > 0 ? Math.round((perf.totalSuccess / perf.totalSent) * 100) : 0,
      avgLatencyMs: perf.avgLatencyMs,
      sampleSize: perf.totalSent,
      region: region || null,
      isShared: false,
      sharedAt: null,
    }));

    for (const snapshot of snapshots) {
      await this.db.insert(schema.performanceSnapshots).values(snapshot);
    }

    return snapshots;
  }

  async getPerformanceSnapshots(limit: number = 100) {
    return this.db
      .select()
      .from(schema.performanceSnapshots)
      .orderBy(desc(schema.performanceSnapshots.snapshotAt))
      .limit(limit);
  }

  async exportSharedPerformanceData() {
    return this.db
      .select()
      .from(schema.performanceSnapshots)
      .where(eq(schema.performanceSnapshots.isShared, true))
      .orderBy(desc(schema.performanceSnapshots.snapshotAt));
  }

  // ============================================================
  // MESSAGE RECEIPTS
  // ============================================================

  async saveMessageReceipt(receipt: schema.NewMessageReceipt) {
    return this.db.insert(schema.messageReceipts).values(receipt);
  }

  async getMessageReceipts(messageUuid: string) {
    return this.db
      .select()
      .from(schema.messageReceipts)
      .where(eq(schema.messageReceipts.messageUuid, messageUuid))
      .orderBy(schema.messageReceipts.receivedAt);
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  close() {
    this.client.close();
  }
}
