/**
 * Rate Limit Cooldown Manager
 *
 * Manages cooldown periods for rate-limited protocols/relays/nodes
 * and provides periodic notifications to users
 */

import chalk from 'chalk';
import { formatCooldown } from './rate-limit-detector.js';

export interface CooldownEntry {
  protocol: string;
  relay: string | null;
  cooldownUntil: number;
  reason: string;
  lastNotified?: number;
}

export interface CooldownStatus {
  isInCooldown: boolean;
  remainingMs?: number;
  reason?: string;
}

export class RateLimitManager {
  private cooldowns: Map<string, CooldownEntry> = new Map();
  private notificationInterval: number = 5 * 60 * 1000; // Notify every 5 minutes
  private notificationTimer?: NodeJS.Timeout;

  constructor(notificationInterval?: number) {
    if (notificationInterval) {
      this.notificationInterval = notificationInterval;
    }

    // Start periodic notification
    this.startPeriodicNotifications();
  }

  /**
   * Generate a unique key for protocol/relay combination
   */
  private getKey(protocol: string, relay: string | null): string {
    return relay ? `${protocol}:${relay}` : protocol;
  }

  /**
   * Add a cooldown for a protocol/relay
   */
  setCooldown(
    protocol: string,
    relay: string | null,
    cooldownMs: number,
    reason: string
  ): void {
    const key = this.getKey(protocol, relay);
    const cooldownUntil = Date.now() + cooldownMs;

    this.cooldowns.set(key, {
      protocol,
      relay,
      cooldownUntil,
      reason,
      lastNotified: Date.now(),
    });

    // Immediate notification
    const relayStr = relay ? ` relay ${chalk.cyan(relay)}` : '';
    console.log(
      chalk.yellow(
        `⏸️  Pausing ${chalk.bold(protocol)}${relayStr} for ${formatCooldown(cooldownMs)} (${reason})`
      )
    );
  }

  /**
   * Check if a protocol/relay is in cooldown
   */
  checkCooldown(protocol: string, relay: string | null = null): CooldownStatus {
    const key = this.getKey(protocol, relay);
    const entry = this.cooldowns.get(key);

    if (!entry) {
      return { isInCooldown: false };
    }

    const now = Date.now();

    // Check if cooldown has expired
    if (now >= entry.cooldownUntil) {
      this.cooldowns.delete(key);

      // Notify user that cooldown is over
      const relayStr = entry.relay ? ` relay ${chalk.cyan(entry.relay)}` : '';
      console.log(
        chalk.green(`✅ ${chalk.bold(entry.protocol)}${relayStr} is now available again`)
      );

      return { isInCooldown: false };
    }

    const remainingMs = entry.cooldownUntil - now;

    return {
      isInCooldown: true,
      remainingMs,
      reason: entry.reason,
    };
  }

  /**
   * Get all active cooldowns
   */
  getActiveCooldowns(): CooldownEntry[] {
    const now = Date.now();
    const active: CooldownEntry[] = [];

    for (const [key, entry] of this.cooldowns.entries()) {
      if (entry.cooldownUntil > now) {
        active.push(entry);
      } else {
        // Clean up expired cooldowns
        this.cooldowns.delete(key);
      }
    }

    return active;
  }

  /**
   * Clear a specific cooldown
   */
  clearCooldown(protocol: string, relay: string | null = null): boolean {
    const key = this.getKey(protocol, relay);
    return this.cooldowns.delete(key);
  }

  /**
   * Clear all cooldowns
   */
  clearAllCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * Get cooldown summary for display
   */
  getCooldownSummary(): string {
    const active = this.getActiveCooldowns();

    if (active.length === 0) {
      return '';
    }

    const now = Date.now();
    const lines: string[] = [chalk.yellow('\n⏸️  Active Rate Limit Cooldowns:')];

    for (const entry of active) {
      const remainingMs = entry.cooldownUntil - now;
      const relayStr = entry.relay ? ` (${entry.relay})` : '';
      const timeStr = formatCooldown(remainingMs);

      lines.push(
        chalk.gray(`  • ${chalk.white(entry.protocol)}${relayStr}: ${timeStr} remaining`)
      );
    }

    return lines.join('\n');
  }

  /**
   * Start periodic notifications about active cooldowns
   */
  private startPeriodicNotifications(): void {
    this.notificationTimer = setInterval(() => {
      this.notifyActiveCooldowns();
    }, this.notificationInterval);

    // Don't keep the process alive just for notifications
    if (this.notificationTimer.unref) {
      this.notificationTimer.unref();
    }
  }

  /**
   * Notify user about active cooldowns (if any)
   */
  private notifyActiveCooldowns(): void {
    const active = this.getActiveCooldowns();

    if (active.length === 0) {
      return;
    }

    const now = Date.now();

    // Only notify about cooldowns that haven't been notified recently
    const toNotify = active.filter((entry) => {
      if (!entry.lastNotified) return true;
      return now - entry.lastNotified >= this.notificationInterval;
    });

    if (toNotify.length === 0) {
      return;
    }

    console.log(chalk.yellow('\n⏸️  Rate Limit Reminder:'));
    console.log(
      chalk.gray(
        '  Some protocols/relays are paused due to rate limiting and not being used:'
      )
    );

    for (const entry of toNotify) {
      const remainingMs = entry.cooldownUntil - now;
      const relayStr = entry.relay ? ` (${chalk.cyan(entry.relay)})` : '';
      const timeStr = formatCooldown(remainingMs);

      console.log(
        chalk.gray(
          `  • ${chalk.white(entry.protocol)}${relayStr}: ${timeStr} remaining - ${entry.reason}`
        )
      );

      // Update last notified time
      entry.lastNotified = now;
    }

    console.log('');
  }

  /**
   * Manually trigger a cooldown notification
   */
  notifyNow(): void {
    const summary = this.getCooldownSummary();
    if (summary) {
      console.log(summary);
    }
  }

  /**
   * Stop periodic notifications
   */
  stop(): void {
    if (this.notificationTimer) {
      clearInterval(this.notificationTimer);
      this.notificationTimer = undefined;
    }
  }

  /**
   * Filter a list of relays to exclude those in cooldown
   */
  filterAvailableRelays(protocol: string, relays: string[]): string[] {
    return relays.filter((relay) => {
      const status = this.checkCooldown(protocol, relay);
      return !status.isInCooldown;
    });
  }

  /**
   * Get a user-friendly status message
   */
  getStatusMessage(protocol: string, relay: string | null = null): string | null {
    const status = this.checkCooldown(protocol, relay);

    if (!status.isInCooldown) {
      return null;
    }

    const relayStr = relay ? ` (${relay})` : '';
    const timeStr = formatCooldown(status.remainingMs!);

    return `${protocol}${relayStr} is paused for ${timeStr} due to rate limiting`;
  }
}
