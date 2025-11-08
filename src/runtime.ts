/**
 * Runtime Detection Utilities
 *
 * Detect which JavaScript runtime is being used (Node.js, Bun, or Deno)
 * This is useful for enabling/disabling features based on runtime capabilities
 */

export type Runtime = 'node' | 'bun' | 'deno' | 'unknown';

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): Runtime {
  // Check for Bun
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return 'bun';
  }

  // Check for Deno
  if (typeof (globalThis as any).Deno !== 'undefined') {
    return 'deno';
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }

  return 'unknown';
}

/**
 * Check if the current runtime supports XMTP native bindings
 * XMTP works on Node.js and Deno, but has issues with Bun's FFI
 */
export function supportsXMTP(): boolean {
  const runtime = detectRuntime();
  return runtime === 'node' || runtime === 'deno';
}

/**
 * Check if the current runtime supports Waku
 * Waku requires BroadcastChannel which is unstable in Deno
 * (Deno requires --unstable-broadcast-channel flag)
 */
export function supportsWaku(): boolean {
  const runtime = detectRuntime();
  // Waku works on Node.js and Bun, but requires --unstable-broadcast-channel on Deno
  return runtime === 'node' || runtime === 'bun';
}

/**
 * Get a display name for the current runtime
 */
export function getRuntimeName(): string {
  const runtime = detectRuntime();
  switch (runtime) {
    case 'node':
      return 'Node.js';
    case 'bun':
      return 'Bun';
    case 'deno':
      return 'Deno';
    default:
      return 'Unknown';
  }
}

/**
 * Log runtime information
 */
export function logRuntimeInfo(): void {
  const runtime = detectRuntime();
  const xmtpSupport = supportsXMTP();
  const wakuSupport = supportsWaku();

  console.log(`🔧 Runtime: ${getRuntimeName()}`);
  console.log(`   XMTP Support: ${xmtpSupport ? '✅' : '❌'}`);
  console.log(`   Waku Support: ${wakuSupport ? '✅' : '❌'}`);

  if (!xmtpSupport) {
    console.log(`   Note: XMTP native bindings require Node.js or Deno`);
  }
  if (!wakuSupport) {
    console.log(`   Note: Waku requires BroadcastChannel (run Deno with --unstable-broadcast-channel)`);
  }
  console.log('');
}
