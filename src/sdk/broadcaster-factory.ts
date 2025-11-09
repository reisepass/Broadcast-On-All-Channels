/**
 * Factory functions for creating broadcasters with common configurations
 */

import { Broadcaster, type BroadcasterOptions } from '../broadcaster.js';
import { ChatBroadcaster } from '../chat-broadcaster.js';
import { ChatDatabase } from '../database.js';
import type { UnifiedIdentity } from '../identity.js';
import { supportsXMTP, supportsWaku } from '../runtime.js';

/**
 * Default broadcaster options with all protocols enabled where supported
 */
export function getDefaultBroadcasterOptions(): BroadcasterOptions {
  return {
    xmtpEnabled: supportsXMTP(), // Auto-enabled on Node.js/Deno
    xmtpEnv: 'dev',
    nostrEnabled: true,
    nostrRelays: [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
    ],
    wakuEnabled: supportsWaku(),
    mqttEnabled: true,
    mqttBrokers: [
      'mqtt://broker.hivemq.com:1883',
      'mqtt://broker.emqx.io:1883',
      'mqtt://test.mosquitto.org:1883',
    ],
    irohEnabled: true,
  };
}

/**
 * Create a basic Broadcaster instance
 */
export async function createBroadcaster(
  identity: UnifiedIdentity,
  options?: Partial<BroadcasterOptions>
): Promise<Broadcaster> {
  const mergedOptions = {
    ...getDefaultBroadcasterOptions(),
    ...options,
  };

  const broadcaster = new Broadcaster(identity, mergedOptions);
  await broadcaster.initialize();
  return broadcaster;
}

/**
 * Create a ChatBroadcaster instance with database
 */
export async function createChatBroadcaster(
  identity: UnifiedIdentity,
  dbPath?: string,
  options?: Partial<BroadcasterOptions>
): Promise<{ broadcaster: ChatBroadcaster; db: ChatDatabase }> {
  const db = new ChatDatabase(dbPath);
  const mergedOptions = {
    ...getDefaultBroadcasterOptions(),
    ...options,
  };

  const broadcaster = new ChatBroadcaster(identity, db, mergedOptions);
  await broadcaster.initialize();

  return { broadcaster, db };
}

/**
 * Create multiple broadcasters for multi-user testing
 */
export async function createMultipleBroadcasters(
  identities: UnifiedIdentity[],
  options?: Partial<BroadcasterOptions>
): Promise<Broadcaster[]> {
  const broadcasters = identities.map(identity =>
    createBroadcaster(identity, options)
  );
  return Promise.all(broadcasters);
}

/**
 * Create multiple chat broadcasters for multi-user testing
 */
export async function createMultipleChatBroadcasters(
  identities: UnifiedIdentity[],
  options?: Partial<BroadcasterOptions>
): Promise<Array<{ broadcaster: ChatBroadcaster; db: ChatDatabase }>> {
  const broadcasters = identities.map((identity, index) =>
    createChatBroadcaster(identity, `./data/test-user-${index}.db`, options)
  );
  return Promise.all(broadcasters);
}
