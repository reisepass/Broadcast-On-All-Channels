#!/usr/bin/env bun
/**
 * CLI Chat Client
 *
 * Features:
 * - Creates or loads identity
 * - Connects to all available protocols
 * - Interactive chat mode
 * - Shows acknowledgments with checkmarks
 * - Color-coded received messages
 * - Displays message delivery times per protocol
 */

import * as readline from 'readline/promises';
import chalk from 'chalk';

import type { UnifiedIdentity } from './identity.js';
import { ChatDatabase } from './database.js';
import { ChatBroadcaster } from './chat-broadcaster.js';
import type { ChatMessage } from './message-types.js';
import { UserManager, type UserProfile } from './user-manager.js';

class ChatClient {
  private identity!: UnifiedIdentity;
  private db!: ChatDatabase;
  private broadcaster!: ChatBroadcaster;
  private chatPartner?: string;
  private rl!: readline.Interface;
  private userManager: UserManager;
  private currentUser!: UserProfile;

  constructor() {
    this.userManager = new UserManager();
  }

  async start() {
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('  Multi-Protocol Chat Client'));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════\n'));

    // Select or create user
    await this.selectUser();

    // Initialize database with user-specific path
    this.db = new ChatDatabase(this.userManager.getUserDbPath(this.currentUser.name));

    // Initialize broadcaster
    this.broadcaster = new ChatBroadcaster(this.identity, this.db);

    // Set up message handler
    this.broadcaster.onMessage((message, protocol) => {
      this.handleIncomingMessage(message, protocol);
    });

    // Initialize broadcaster
    console.log(chalk.yellow('🚀 Connecting to protocols...\n'));
    try {
      await this.broadcaster.initialize();
      await this.broadcaster.startListening();
      console.log(chalk.green('✅ Connected and listening for messages\n'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Some protocols may have connection issues'));
      console.log(chalk.gray(`   ${error}\n`));
      console.log(chalk.green('✅ Continuing with available protocols\n'));
    }

    // Start interactive mode
    await this.interactiveMode();
  }

  private async selectUser() {
    const users = this.userManager.listUsers();

    if (users.length === 0) {
      console.log(chalk.blue('👋 Welcome! Creating your first user...\n'));
      this.currentUser = this.userManager.createUser();
      console.log(chalk.green(`✅ Created user: ${chalk.bold(this.currentUser.name)}\n`));
    } else {
      console.log(chalk.yellow('📋 Select a user or create a new one:\n'));

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const lastUsed = new Date(user.lastUsedAt).toLocaleString();
        console.log(chalk.gray(`  ${i + 1}. ${chalk.white(user.name)} (last used: ${lastUsed})`));
      }
      console.log(chalk.gray(`  ${users.length + 1}. ${chalk.green('Create new user')}`));
      console.log('');

      // Create temporary readline interface for selection
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      while (true) {
        const answer = await tempRl.question(chalk.yellow('Your choice: '));
        const choice = parseInt(answer);

        if (choice >= 1 && choice <= users.length) {
          this.currentUser = users[choice - 1];
          this.userManager.updateLastUsed(this.currentUser.name);
          console.log(chalk.green(`\n✅ Using user: ${chalk.bold(this.currentUser.name)}\n`));
          tempRl.close();
          break;
        } else if (choice === users.length + 1) {
          this.currentUser = this.userManager.createUser();
          console.log(chalk.green(`\n✅ Created user: ${chalk.bold(this.currentUser.name)}\n`));
          tempRl.close();
          break;
        } else {
          console.log(chalk.red('Invalid choice. Please try again.'));
        }
      }
    }

    // Set identity from user profile
    this.identity = this.currentUser.identity;

    // Display identity
    console.log(chalk.cyan('Your Identity:\n'));
    console.log(chalk.gray('User Name:'), chalk.white.bold(this.currentUser.name));
    console.log('');
    console.log(chalk.gray('secp256k1 (XMTP, Nostr, Waku, MQTT):'));
    console.log(chalk.gray('  Ethereum Address:'), chalk.white(this.identity.secp256k1.ethereumAddress));
    console.log('');
    console.log(chalk.gray('Ed25519 (IROH):'));
    console.log(chalk.gray('  Node ID:'), chalk.white(this.identity.ed25519.nodeId.slice(0, 16) + '...'));
    console.log('');
    console.log(chalk.yellow('📎 Your Magnet Link (share this):'));
    console.log(chalk.cyan(this.identity.magnetLink));
    console.log('');
  }

  private async interactiveMode() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(chalk.yellow('\n💬 Interactive Chat Mode\n'));
    console.log(chalk.gray('Commands:'));
    console.log(chalk.gray('  /chat <magnet-link> - Start chatting with someone'));
    console.log(chalk.gray('  /history - Show conversation history'));
    console.log(chalk.gray('  /status - Show protocol status'));
    console.log(chalk.gray('  /quit - Exit'));
    console.log('');

    while (true) {
      const input = await this.rl.question(
        this.chatPartner
          ? chalk.green('You: ')
          : chalk.yellow('Command: ')
      );

      if (!input.trim()) continue;

      if (input.startsWith('/')) {
        await this.handleCommand(input);
      } else {
        if (!this.chatPartner) {
          console.log(chalk.red('❌ Not in chat mode. Use /chat <magnet-link> to start chatting'));
          continue;
        }
        await this.sendMessage(input);
      }
    }
  }

  private async handleCommand(input: string) {
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/chat':
        if (parts.length < 2) {
          console.log(chalk.red('❌ Usage: /chat <magnet-link>'));
          return;
        }
        this.chatPartner = parts.slice(1).join(' ');
        console.log(chalk.green(`✅ Now chatting with: ${this.chatPartner.slice(0, 50)}...`));
        console.log(chalk.gray('Type your messages and press Enter to send\n'));
        await this.showConversationHistory();
        break;

      case '/history':
        await this.showConversationHistory();
        break;

      case '/status':
        await this.showProtocolStatus();
        break;

      case '/quit':
        console.log(chalk.yellow('\n👋 Goodbye!'));
        this.db.close();
        process.exit(0);

      default:
        console.log(chalk.red(`❌ Unknown command: ${command}`));
    }
  }

  private async sendMessage(content: string) {
    if (!this.chatPartner) return;

    const sentAt = Date.now();
    console.log(chalk.gray(`\n📤 Sending...`));

    try {
      const results = await this.broadcaster.sendMessage(this.chatPartner, content);

      // Display results with checkmarks
      console.log(chalk.gray('Delivery status:'));
      for (const result of results) {
        if (result.success) {
          console.log(chalk.green(`  ✓ ${result.protocol.padEnd(20)} ${result.latencyMs}ms`));
        } else {
          console.log(chalk.red(`  ✗ ${result.protocol.padEnd(20)} Failed`));
        }
      }
      console.log('');
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error}`));
    }
  }

  private handleIncomingMessage(message: ChatMessage, protocol: string) {
    // Only show if from current chat partner
    if (this.chatPartner && message.fromMagnetLink !== this.chatPartner) {
      return;
    }

    // Skip acknowledgments (we handle them silently)
    if (message.type === 'acknowledgment') {
      // Get the original message and show checkmark
      const receipts = this.db.getMessageReceipts(message.content.replace('ACK: ', ''));
      if (receipts.length > 0) {
        console.log(chalk.green(`\n  ✓ Acknowledged via ${protocol} (+${Date.now() - message.timestamp}ms)`));
      }
      return;
    }

    // Get all receipts for this message
    const receipts = this.db.getMessageReceipts(message.uuid);
    const firstReceipt = receipts[0];

    // Display the message
    console.log('');
    console.log(chalk.blue.bold(`Them: ${message.content}`));
    console.log(chalk.gray(`  First received via: ${firstReceipt?.protocol || protocol}`));

    // Show subsequent receipts with time deltas
    if (receipts.length > 1) {
      console.log(chalk.gray(`  Also received:`));
      for (let i = 1; i < receipts.length; i++) {
        const receipt = receipts[i];
        const delta = receipt.receivedAt - firstReceipt.receivedAt;
        console.log(chalk.gray(`    • ${receipt.protocol} (+${delta}ms)`));
      }
    }
    console.log('');

    // Redraw prompt
    if (this.chatPartner) {
      process.stdout.write(chalk.green('You: '));
    }
  }

  private async showConversationHistory() {
    if (!this.chatPartner) {
      console.log(chalk.red('❌ Not in chat mode'));
      return;
    }

    const messages = await this.db.getConversation(this.identity.magnetLink, this.chatPartner, 20);

    if (messages.length === 0) {
      console.log(chalk.gray('\n📭 No message history\n'));
      return;
    }

    console.log(chalk.cyan('\n📜 Conversation History:\n'));

    for (const msg of messages) {
      if (msg.isAcknowledgment) continue; // Skip acks in history

      const isFromMe = msg.fromIdentity === this.identity.magnetLink;
      const prefix = isFromMe ? chalk.green('You:') : chalk.blue('Them:');
      const time = new Date(msg.timestamp).toLocaleTimeString();

      console.log(`${chalk.gray(`[${time}]`)} ${prefix} ${msg.content}`);

      if (msg.firstReceivedProtocol) {
        console.log(chalk.gray(`  via ${msg.firstReceivedProtocol}`));
      }
    }
    console.log('');
  }

  private async showProtocolStatus() {
    const performance = await this.db.getProtocolPerformance();

    console.log(chalk.cyan('\n📊 Protocol Performance:\n'));

    if (performance.length === 0) {
      console.log(chalk.gray('No data yet\n'));
      return;
    }

    for (const perf of performance) {
      const successRate = perf.totalSent > 0
        ? ((perf.totalAcked / perf.totalSent) * 100).toFixed(1)
        : '0.0';

      console.log(chalk.white(perf.protocol));
      console.log(chalk.gray(`  Sent: ${perf.totalSent}, Acked: ${perf.totalAcked} (${successRate}%)`));
      console.log(chalk.gray(`  Avg Latency: ${perf.avgLatencyMs || 'N/A'}ms`));
      console.log('');
    }
  }
}

// Start the client
const client = new ChatClient();
client.start().catch(console.error);
