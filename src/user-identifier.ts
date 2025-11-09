/**
 * User Identifier Utilities
 *
 * Extracts short, human-readable identifiers from identity information
 * to display who sent messages.
 */

import { decodeIdentity } from './identity.js';

export interface UserIdentifier {
  secp256k1Short: string;  // First 3 + last 3 chars of secp256k1 public key
  ed25519Short: string;     // First 3 + last 3 chars of ed25519 public key
  ethShort: string;         // Last 3 chars of ethereum address
  displayName: string;      // Combined display name (e.g., "abc..xyz:123..789:def")
}

/**
 * Extract a short identifier from a magnet link
 * Format: [first 3..last 3 of secp256k1]:[first 3..last 3 of ed25519]:[last 3 of eth]
 */
export function getUserIdentifier(magnetLink: string): UserIdentifier | null {
  try {
    const identity = decodeIdentity(magnetLink);
    if (!identity) {
      return null;
    }

    const secp256k1Pub = identity.secp256k1?.publicKey;
    const ed25519Pub = identity.ed25519?.publicKey;
    const ethAddress = identity.secp256k1?.ethereumAddress;

    if (!secp256k1Pub || !ed25519Pub || !ethAddress) {
      return null;
    }

    // Take first 3 and last 3 characters of secp256k1 public key
    const secp256k1Short = secp256k1Pub.slice(0, 3) + '..' + secp256k1Pub.slice(-3);

    // Take first 3 and last 3 characters of ed25519 public key
    const ed25519Short = ed25519Pub.slice(0, 3) + '..' + ed25519Pub.slice(-3);

    // Take last 3 characters of ethereum address (skip 0x prefix)
    const ethShort = ethAddress.slice(-3);

    // Combined display name
    const displayName = `${secp256k1Short}:${ed25519Short}:${ethShort}`;

    return {
      secp256k1Short,
      ed25519Short,
      ethShort,
      displayName,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get display name for a user, with fallback to "Unknown"
 */
export function getDisplayName(magnetLink: string): string {
  const identifier = getUserIdentifier(magnetLink);
  return identifier ? identifier.displayName : 'Unknown';
}
