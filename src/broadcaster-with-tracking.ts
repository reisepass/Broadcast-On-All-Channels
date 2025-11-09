/**
 * Broadcaster with Performance and Rate Limit Tracking
 *
 * Wraps the base Broadcaster class to add:
 * - Automatic rate limit detection
 * - Performance metrics tracking
 * - Message send logging
 * - Rate limit cooldown management
 */

import { Broadcaster, type BroadcastResult, type BroadcasterOptions } from './broadcaster.js';
import type { UnifiedIdentity } from './identity.js';
import { ChatDatabase } from './db/database.js';
import { detectRateLimit, formatCooldown } from './rate-limit-detector.js';
import { RateLimitManager } from './rate-limit-manager.js';
import type { NewMessageSendLog } from './db/schema.js';

export class BroadcasterWithTracking extends Broadcaster {
  private db: ChatDatabase;
  private rateLimitManager: RateLimitManager;

  constructor(identity: UnifiedIdentity, db: ChatDatabase, options?: BroadcasterOptions) {
    super(identity, options);
    this.db = db;
    this.rateLimitManager = new RateLimitManager();
  }

  /**
   * Override broadcast to add tracking and cooldown management
   */
  async broadcast(recipientMagnetLink: string, message: string): Promise<BroadcastResult[]> {
    // Show active cooldowns summary before sending
    this.showActiveCooldowns();

    // Call parent broadcast method
    const results = await super.broadcast(recipientMagnetLink, message);

    // Track each result
    await this.trackBroadcastResults(results);

    return results;
  }

  /**
   * Show active cooldowns (if any)
   */
  private showActiveCooldowns(): void {
    const summary = this.rateLimitManager.getCooldownSummary();
    if (summary) {
      console.log(summary);
    }
  }

  /**
   * Check if a protocol/relay is in cooldown before sending
   */
  shouldSkipDueToCooldown(protocol: string, relay: string | null = null): boolean {
    const status = this.rateLimitManager.checkCooldown(protocol, relay);
    return status.isInCooldown;
  }

  /**
   * Track broadcast results in database
   */
  private async trackBroadcastResults(results: BroadcastResult[]) {
    const now = Date.now();

    for (const result of results) {
      try {
        // Parse protocol and relay from result
        const { protocol, relay } = this.parseProtocolInfo(result.protocol);

        // Log the send attempt
        const sendLog: NewMessageSendLog = {
          messageUuid: `msg-${now}-${Math.random().toString(36).slice(2)}`, // Generate UUID
          protocol,
          relay,
          sentAt: now,
          success: result.success,
          errorType: result.error ? this.classifyError(result.error, protocol) : null,
          errorMessage: result.error || null,
          latencyMs: result.latencyMs || null,
        };

        await this.db.logMessageSend(sendLog);

        // Check for rate limiting
        const rateLimitDetection = result.error
          ? detectRateLimit(new Error(result.error), protocol)
          : { isRateLimited: false, errorType: 'none' };

        // Record rate limit event or connection failure if detected
        if (rateLimitDetection.isRateLimited) {
          const cooldownMs = rateLimitDetection.cooldownMs || 60000;
          const isConnectionFailure = rateLimitDetection.isConnectionFailure || false;

          // Determine reason message
          const reason = isConnectionFailure
            ? `Connection failure: ${result.error || 'Unable to connect'}`
            : result.error || 'Rate limit detected';

          // Set cooldown in rate limit manager
          this.rateLimitManager.setCooldown(
            protocol,
            relay,
            cooldownMs,
            reason
          );

          // Record in database
          await this.db.recordRateLimitEvent({
            protocol,
            relay,
            errorMessage: reason,
            cooldownUntil: now + cooldownMs,
          });
        }

        // Update protocol performance
        await this.db.updateProtocolPerformance(protocol, relay, {
          success: result.success,
          latencyMs: result.latencyMs,
          errorType: sendLog.errorType || undefined,
          isRateLimited: rateLimitDetection.isRateLimited,
        });
      } catch (trackingError) {
        console.error('Failed to track broadcast result:', trackingError);
        // Don't let tracking errors break the broadcast
      }
    }
  }

  /**
   * Parse protocol and relay from result string
   * e.g., "Nostr (3 relays)" -> { protocol: "Nostr", relay: null }
   * e.g., "MQTT (2/3 brokers)" -> { protocol: "MQTT", relay: null }
   */
  private parseProtocolInfo(protocolStr: string): { protocol: string; relay: string | null } {
    // Remove metadata in parentheses
    const protocol = protocolStr.replace(/\s*\([^)]*\)/, '').trim();

    // For now, we don't extract individual relay URLs from the result
    // In the future, we could enhance BroadcastResult to include relay info
    return { protocol, relay: null };
  }

  /**
   * Classify error type
   */
  private classifyError(errorMsg: string, protocol: string): string {
    const detection = detectRateLimit(new Error(errorMsg), protocol);

    if (detection.isRateLimited) {
      return 'rate_limit';
    }

    const lowerMsg = errorMsg.toLowerCase();

    if (lowerMsg.includes('timeout')) return 'timeout';
    if (lowerMsg.includes('network')) return 'network';
    if (lowerMsg.includes('connection')) return 'connection';
    if (lowerMsg.includes('auth')) return 'auth';
    if (lowerMsg.includes('permission')) return 'permission';

    return 'unknown';
  }

  /**
   * Check if a protocol is currently rate limited
   */
  async isRateLimited(protocol: string, relay: string | null = null): Promise<boolean> {
    const status = await this.db.checkRateLimitStatus(protocol, relay);
    return status.isRateLimited;
  }

  /**
   * Get rate limit info for a protocol
   */
  async getRateLimitInfo(protocol: string, relay: string | null = null) {
    return this.db.checkRateLimitStatus(protocol, relay);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(protocol?: string, relay?: string | null) {
    return this.db.getProtocolPerformance(protocol, relay);
  }

  /**
   * Create performance snapshot for sharing
   */
  async createPerformanceSnapshot(region?: string) {
    return this.db.createPerformanceSnapshot(region);
  }

  /**
   * Export shareable performance data
   */
  async exportPerformanceData() {
    return this.db.exportSharedPerformanceData();
  }

  /**
   * Get the rate limit manager (for advanced usage)
   */
  getRateLimitManager(): RateLimitManager {
    return this.rateLimitManager;
  }

  /**
   * Get active cooldowns
   */
  getActiveCooldowns() {
    return this.rateLimitManager.getActiveCooldowns();
  }

  /**
   * Clear a specific cooldown
   */
  clearCooldown(protocol: string, relay: string | null = null): boolean {
    return this.rateLimitManager.clearCooldown(protocol, relay);
  }

  /**
   * Shutdown broadcaster and cleanup
   */
  async shutdown(): Promise<void> {
    this.rateLimitManager.stop();
    await super.shutdown();
  }
}
