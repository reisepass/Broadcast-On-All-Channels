#!/usr/bin/env node
/**
 * Rate Limit Statistics CLI
 *
 * View rate limiting and performance statistics for all protocols
 */

import chalk from 'chalk';
import { ChatDatabase } from './db/database.js';
import { formatCooldown } from './rate-limit-detector.js';

interface CLIArgs {
  protocol?: string;
  relay?: string;
  user?: string;
  history?: boolean;
  export?: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--protocol' || arg === '-p') {
      args.protocol = argv[++i];
    } else if (arg === '--relay' || arg === '-r') {
      args.relay = argv[++i];
    } else if (arg === '--user' || arg === '-u') {
      args.user = argv[++i];
    } else if (arg === '--history') {
      args.history = true;
    } else if (arg === '--export') {
      args.export = true;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  // Determine database path
  let dbPath = './data/chat.db';
  if (args.user) {
    dbPath = `./data/users/${args.user}.db`;
  }

  console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('  Rate Limiting & Performance Statistics'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════\n'));

  const db = await ChatDatabase.create(dbPath);

  try {
    if (args.export) {
      await exportPerformanceData(db);
    } else if (args.history) {
      await showRateLimitHistory(db, args.protocol, args.relay);
    } else {
      await showCurrentStatus(db, args.protocol, args.relay);
    }
  } finally {
    db.close();
  }
}

async function showCurrentStatus(db: ChatDatabase, protocol?: string, relay?: string | null) {
  console.log(chalk.yellow('📊 Current Rate Limit Status\n'));

  // Get performance metrics
  const metrics = await db.getProtocolPerformance(protocol, relay);

  if (metrics.length === 0) {
    console.log(chalk.gray('No data available yet.\n'));
    return;
  }

  for (const metric of metrics) {
    const protocolName = metric.relay
      ? `${metric.protocol} (${metric.relay})`
      : metric.protocol;

    console.log(chalk.white.bold(protocolName));
    console.log(chalk.gray('─'.repeat(60)));

    // Calculate success rate
    const successRate =
      metric.totalSent > 0 ? ((metric.totalSuccess / metric.totalSent) * 100).toFixed(1) : '0.0';

    // Availability indicator
    const availIcon = metric.isCurrentlyAvailable ? chalk.green('✓') : chalk.red('✗');

    console.log(`  ${availIcon} Available: ${chalk.white(metric.isCurrentlyAvailable ? 'Yes' : 'No')}`);

    console.log(`  📤 Sent: ${chalk.white(metric.totalSent)}`);
    console.log(`  ✅ Success: ${chalk.green(metric.totalSuccess)} (${successRate}%)`);
    console.log(`  ❌ Failed: ${chalk.red(metric.totalFailed)}`);

    if (metric.totalRateLimited > 0) {
      console.log(`  🚫 Rate Limited: ${chalk.yellow(metric.totalRateLimited)}`);
    }

    if (metric.avgLatencyMs) {
      console.log(`  ⚡ Avg Latency: ${chalk.cyan(metric.avgLatencyMs + 'ms')}`);

      if (metric.minLatencyMs && metric.maxLatencyMs) {
        console.log(
          `  📊 Range: ${chalk.gray(metric.minLatencyMs + 'ms')} - ${chalk.gray(metric.maxLatencyMs + 'ms')}`
        );
      }
    }

    if (metric.consecutiveFailures > 0) {
      console.log(
        `  ⚠️  Consecutive Failures: ${chalk.red(metric.consecutiveFailures)}`
      );
    }

    if (metric.lastRateLimitAt) {
      const timeSince = Date.now() - metric.lastRateLimitAt;
      const timeStr = formatCooldown(timeSince);
      console.log(`  🕒 Last Rate Limited: ${chalk.yellow(timeStr + ' ago')}`);
    }

    // Check current rate limit status
    const rateLimitStatus = await db.checkRateLimitStatus(metric.protocol, metric.relay);

    if (rateLimitStatus.isRateLimited) {
      const cooldownRemaining = rateLimitStatus.cooldownUntil
        ? rateLimitStatus.cooldownUntil - Date.now()
        : 0;

      if (cooldownRemaining > 0) {
        console.log(
          `  ⏳ Cooldown: ${chalk.red(formatCooldown(cooldownRemaining) + ' remaining')}`
        );
      }
    }

    // Message counts
    console.log(
      `  📨 Last minute: ${chalk.white(rateLimitStatus.messagesInLastMinute)}`
    );
    console.log(`  📨 Last hour: ${chalk.white(rateLimitStatus.messagesInLastHour)}`);
    console.log(`  📨 Last day: ${chalk.white(rateLimitStatus.messagesInLastDay)}`);

    console.log('');
  }
}

async function showRateLimitHistory(db: ChatDatabase, protocol?: string, relay?: string | null) {
  console.log(chalk.yellow('📜 Rate Limit Event History\n'));

  if (!protocol) {
    // Get all protocols
    const metrics = await db.getProtocolPerformance();
    const protocols = [...new Set(metrics.map((m) => m.protocol))];

    for (const proto of protocols) {
      const events = await db.getRateLimitHistory(proto, null, 5);

      if (events.length > 0) {
        console.log(chalk.white.bold(proto));
        console.log(chalk.gray('─'.repeat(60)));

        for (const event of events) {
          const date = new Date(event.occurredAt).toLocaleString();
          const relayStr = event.relay ? ` (${event.relay})` : '';

          console.log(`  ${chalk.gray(date)}${relayStr}`);
          console.log(`    Error: ${chalk.red(event.errorMessage || 'Unknown')}`);
          console.log(
            `    Messages - Minute: ${event.messagesInLastMinute}, Hour: ${event.messagesInLastHour}, Day: ${event.messagesInLastDay}`
          );
        }

        console.log('');
      }
    }
  } else {
    const events = await db.getRateLimitHistory(protocol, relay || null, 10);

    if (events.length === 0) {
      console.log(chalk.gray('No rate limit events recorded for this protocol.\n'));
      return;
    }

    for (const event of events) {
      const date = new Date(event.occurredAt).toLocaleString();
      const relayStr = event.relay ? ` (${event.relay})` : '';

      console.log(chalk.white.bold(date + relayStr));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`  Error: ${chalk.red(event.errorMessage || 'Unknown')}`);
      console.log(
        `  Messages sent before limit:`
      );
      console.log(`    • Last minute: ${chalk.white(event.messagesInLastMinute)}`);
      console.log(`    • Last hour: ${chalk.white(event.messagesInLastHour)}`);
      console.log(`    • Last day: ${chalk.white(event.messagesInLastDay)}`);

      if (event.cooldownUntil) {
        const cooldownTime = new Date(event.cooldownUntil).toLocaleString();
        console.log(`  Cooldown until: ${chalk.yellow(cooldownTime)}`);
      }

      console.log('');
    }
  }
}

async function exportPerformanceData(db: ChatDatabase) {
  console.log(chalk.yellow('📤 Exporting Performance Data\n'));

  // Create snapshot
  const snapshots = await db.createPerformanceSnapshot();

  console.log(chalk.green(`✅ Created ${snapshots.length} performance snapshots\n`));

  // Get export data
  const exportData = await db.exportSharedPerformanceData();

  console.log(chalk.cyan('Shareable Data:\n'));
  console.log(JSON.stringify(exportData, null, 2));
  console.log('');
}

main().catch((error) => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});
