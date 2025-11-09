/**
 * Test helper utilities for multi-user scenarios
 */

import { generateIdentity, type UnifiedIdentity } from '../identity.js';
import type { ChatMessage } from '../message-types.js';

/**
 * Generate multiple test identities with labels
 */
export function generateTestIdentities(count: number, prefix = 'TestUser'): UnifiedIdentity[] {
  return Array.from({ length: count }, (_, i) => generateIdentity());
}

/**
 * Create a test message with timestamp
 */
export function createTestMessage(content: string, from?: string): string {
  const timestamp = new Date().toISOString();
  const sender = from || 'unknown';
  return `[${timestamp}] ${sender}: ${content}`;
}

/**
 * Wait for a condition to be true (with timeout)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 30000,
  checkIntervalMs = 100
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await condition();
    if (result) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }

  return false;
}

/**
 * Wait for N messages to be received
 */
export async function waitForMessages(
  messages: ChatMessage[],
  expectedCount: number,
  timeoutMs = 30000
): Promise<boolean> {
  return waitFor(() => messages.length >= expectedCount, timeoutMs);
}

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random test data
 */
export function randomString(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Generate random message content
 */
export function randomMessage(): string {
  const templates = [
    'Hello from test!',
    'Testing multi-user broadcast',
    'Random test message',
    'Protocol validation test',
  ];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return `${template} - ${randomString(8)}`;
}

/**
 * Cleanup helper for tests
 */
export async function cleanup(
  resources: Array<{ shutdown?: () => Promise<void>; close?: () => void }>
): Promise<void> {
  for (const resource of resources) {
    try {
      if (resource.shutdown) {
        await resource.shutdown();
      }
      if (resource.close) {
        resource.close();
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

/**
 * Create a message collector for testing
 */
export class MessageCollector {
  private messages: ChatMessage[] = [];
  private protocols: Map<string, number> = new Map();

  collect(message: ChatMessage, protocol: string): void {
    this.messages.push(message);
    this.protocols.set(protocol, (this.protocols.get(protocol) || 0) + 1);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getCount(): number {
    return this.messages.length;
  }

  getProtocolCounts(): Map<string, number> {
    return new Map(this.protocols);
  }

  getMessagesByProtocol(protocol: string): ChatMessage[] {
    // Note: We'd need to track protocol per message for this
    // For now, return all messages
    return this.getMessages();
  }

  clear(): void {
    this.messages = [];
    this.protocols.clear();
  }

  hasMessage(predicate: (msg: ChatMessage) => boolean): boolean {
    return this.messages.some(predicate);
  }

  waitForCount(count: number, timeoutMs = 30000): Promise<boolean> {
    return waitFor(() => this.getCount() >= count, timeoutMs);
  }
}
