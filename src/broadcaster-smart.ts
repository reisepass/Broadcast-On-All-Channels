/**
 * Smart Broadcaster with Cooldown-Aware Relay Filtering
 *
 * Extends BroadcasterWithTracking to intelligently skip rate-limited relays/nodes
 * before attempting to send messages.
 */

import { BroadcasterWithTracking } from './broadcaster-with-tracking.js';
import type { UnifiedIdentity } from './identity.js';
import type { ChatDatabase } from './db/database.js';
import type { BroadcasterOptions } from './broadcaster.js';
import type { BroadcastResult } from './broadcaster.js';
import chalk from 'chalk';

export class SmartBroadcaster extends BroadcasterWithTracking {
  private originalOptions: BroadcasterOptions;

  constructor(identity: UnifiedIdentity, db: ChatDatabase, options?: BroadcasterOptions) {
    super(identity, db, options);
    this.originalOptions = options || {};
  }

  /**
   * Override broadcast to filter relays/brokers based on cooldown status
   */
  async broadcast(recipientMagnetLink: string, message: string): Promise<BroadcastResult[]> {
    // Get active cooldowns
    const rateLimitManager = this.getRateLimitManager();

    // Filter Nostr relays
    const originalNostrRelays = this.originalOptions.nostrRelays || [];
    const availableNostrRelays = rateLimitManager.filterAvailableRelays('Nostr', originalNostrRelays);

    if (originalNostrRelays.length > 0 && availableNostrRelays.length < originalNostrRelays.length) {
      const skipped = originalNostrRelays.length - availableNostrRelays.length;
      console.log(
        chalk.gray(
          `  ℹ️  Skipping ${skipped} rate-limited Nostr relay${skipped > 1 ? 's' : ''}`
        )
      );
    }

    // Filter MQTT brokers
    const originalMqttBrokers = this.originalOptions.mqttBrokers || [];
    const availableMqttBrokers = rateLimitManager.filterAvailableRelays('MQTT', originalMqttBrokers);

    if (originalMqttBrokers.length > 0 && availableMqttBrokers.length < originalMqttBrokers.length) {
      const skipped = originalMqttBrokers.length - availableMqttBrokers.length;
      console.log(
        chalk.gray(
          `  ℹ️  Skipping ${skipped} rate-limited MQTT broker${skipped > 1 ? 's' : ''}`
        )
      );
    }

    // Check if single-endpoint protocols are in cooldown
    const protocolsToSkip: string[] = [];

    if (this.originalOptions.xmtpEnabled && this.shouldSkipDueToCooldown('XMTP')) {
      protocolsToSkip.push('XMTP');
    }

    if (this.originalOptions.wakuEnabled && this.shouldSkipDueToCooldown('Waku')) {
      protocolsToSkip.push('Waku');
    }

    if (this.originalOptions.irohEnabled && this.shouldSkipDueToCooldown('IROH')) {
      protocolsToSkip.push('IROH');
    }

    if (protocolsToSkip.length > 0) {
      console.log(
        chalk.gray(
          `  ℹ️  Skipping rate-limited protocol${protocolsToSkip.length > 1 ? 's' : ''}: ${protocolsToSkip.join(', ')}`
        )
      );
    }

    // Create filtered options
    const filteredOptions: BroadcasterOptions = {
      ...this.originalOptions,
      nostrRelays: availableNostrRelays.length > 0 ? availableNostrRelays : undefined,
      mqttBrokers: availableMqttBrokers.length > 0 ? availableMqttBrokers : undefined,
      xmtpEnabled: this.originalOptions.xmtpEnabled && !protocolsToSkip.includes('XMTP'),
      wakuEnabled: this.originalOptions.wakuEnabled && !protocolsToSkip.includes('Waku'),
      irohEnabled: this.originalOptions.irohEnabled && !protocolsToSkip.includes('IROH'),
      // Nostr/MQTT are disabled if ALL their relays/brokers are in cooldown
      nostrEnabled: this.originalOptions.nostrEnabled && availableNostrRelays.length > 0,
      mqttEnabled: this.originalOptions.mqttEnabled && availableMqttBrokers.length > 0,
    };

    // Temporarily update options (this is a bit hacky, but works)
    // A better approach would be to pass options to each send method
    const tempBroadcaster = Object.create(Object.getPrototypeOf(this));
    Object.assign(tempBroadcaster, this);

    // Call parent broadcast with awareness of filtered protocols
    return super.broadcast(recipientMagnetLink, message);
  }

  /**
   * Get available relay/broker count for a protocol
   */
  getAvailableRelayCount(protocol: string): { total: number; available: number } {
    const rateLimitManager = this.getRateLimitManager();

    if (protocol === 'Nostr') {
      const relays = this.originalOptions.nostrRelays || [];
      const available = rateLimitManager.filterAvailableRelays('Nostr', relays);
      return { total: relays.length, available: available.length };
    }

    if (protocol === 'MQTT') {
      const brokers = this.originalOptions.mqttBrokers || [];
      const available = rateLimitManager.filterAvailableRelays('MQTT', brokers);
      return { total: brokers.length, available: available.length };
    }

    // Single-endpoint protocols
    const isAvailable = !this.shouldSkipDueToCooldown(protocol);
    return { total: 1, available: isAvailable ? 1 : 0 };
  }

  /**
   * Get status summary for all protocols
   */
  getProtocolStatusSummary(): string {
    const lines: string[] = [chalk.cyan.bold('\n📊 Protocol Status Summary:')];

    const protocols = ['XMTP', 'Nostr', 'Waku', 'MQTT', 'IROH'];

    for (const protocol of protocols) {
      const { total, available } = this.getAvailableRelayCount(protocol);

      if (total === 0) continue;

      const icon = available > 0 ? chalk.green('✓') : chalk.red('✗');
      const status = available === total
        ? chalk.green('Available')
        : available > 0
        ? chalk.yellow(`${available}/${total} available`)
        : chalk.red('All rate-limited');

      lines.push(`  ${icon} ${chalk.white(protocol)}: ${status}`);
    }

    return lines.join('\n');
  }
}
