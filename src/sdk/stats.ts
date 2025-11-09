/**
 * Shared statistics tracking for protocol performance
 * Used by: continuous-test, live-latency-demo, and multi-user tests
 */

export interface ProtocolStats {
  sent: number;
  received: number;
  totalLatency: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  lastReceived?: number;
}

export interface UserStats {
  name: string;
  protocols: Map<string, ProtocolStats>;
  totalSent: number;
  totalReceived: number;
  startTime?: number;
  lastMessageReceived?: number;
}

/**
 * Normalize protocol names to handle capitalization variations
 * Examples: "nostr", "Nostr", "NOSTR" -> "Nostr"
 */
export function normalizeProtocolName(protocol: string): string {
  const lower = protocol.toLowerCase();
  if (lower.startsWith('mqtt')) return 'MQTT';
  if (lower.startsWith('nostr')) return 'Nostr';
  if (lower.startsWith('xmtp')) return 'XMTP';
  if (lower.startsWith('waku')) return 'Waku';
  if (lower.startsWith('iroh')) return 'IROH';
  return protocol;
}

/**
 * Create initial stats object for a user
 */
export function createUserStats(name: string): UserStats {
  return {
    name,
    protocols: new Map(),
    totalSent: 0,
    totalReceived: 0,
    startTime: Date.now(),
  };
}

/**
 * Get or create protocol stats
 */
export function getProtocolStats(stats: UserStats, protocol: string): ProtocolStats {
  const normalized = normalizeProtocolName(protocol);
  if (!stats.protocols.has(normalized)) {
    stats.protocols.set(normalized, {
      sent: 0,
      received: 0,
      totalLatency: 0,
      avgLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
    });
  }
  return stats.protocols.get(normalized)!;
}

/**
 * Update stats when a message is received
 */
export function updateReceivedStats(stats: UserStats, protocol: string, latencyMs: number): void {
  const protocolStats = getProtocolStats(stats, protocol);
  protocolStats.received++;
  protocolStats.totalLatency += latencyMs;
  protocolStats.avgLatency = protocolStats.totalLatency / protocolStats.received;
  protocolStats.minLatency = Math.min(protocolStats.minLatency, latencyMs);
  protocolStats.maxLatency = Math.max(protocolStats.maxLatency, latencyMs);
  protocolStats.lastReceived = Date.now();
  stats.totalReceived++;
  stats.lastMessageReceived = Date.now();
}

/**
 * Update stats when a message is sent
 */
export function updateSentStats(stats: UserStats, protocol: string): void {
  const protocolStats = getProtocolStats(stats, protocol);
  protocolStats.sent++;
  stats.totalSent++;
}

/**
 * Get sorted protocols by average latency (fastest first)
 */
export function getSortedProtocols(stats: UserStats): Array<[string, ProtocolStats]> {
  return Array.from(stats.protocols.entries()).sort((a, b) => {
    // Sort by avg latency (fastest first)
    if (a[1].avgLatency === 0) return 1;
    if (b[1].avgLatency === 0) return -1;
    return a[1].avgLatency - b[1].avgLatency;
  });
}

/**
 * Format uptime from startTime
 */
export function formatUptime(startTime: number): string {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}
