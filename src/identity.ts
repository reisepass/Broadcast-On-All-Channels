/**
 * Unified Identity System for Multi-Protocol Broadcasting
 *
 * This module creates a unified identity that works across all protocols:
 * - XMTP: secp256k1 (Ethereum wallet)
 * - Nostr: secp256k1 keypair
 * - IROH: Ed25519 keypair
 * - Waku: No built-in identity (we use secp256k1)
 * - MQTT: No built-in identity (we use secp256k1)
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { generateSecretKey, getPublicKey as getNostrPublicKey } from 'nostr-tools';
import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export interface UnifiedIdentity {
  // secp256k1 keys (for XMTP, Nostr, Waku, MQTT)
  secp256k1: {
    privateKey: string; // hex
    publicKey: string; // hex
    ethereumAddress: string; // 0x...
  };

  // Ed25519 keys (for IROH)
  ed25519: {
    privateKey: string; // hex
    publicKey: string; // hex
    nodeId: string; // IROH node ID (derived from public key)
  };

  // Encoded magnet link containing all identity info
  magnetLink: string;
}

/**
 * Generate a new unified identity with keys for all protocols
 */
export function generateIdentity(): UnifiedIdentity {
  // Generate secp256k1 keypair (Ethereum wallet) using viem
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  // Derive public key from private key
  const privateKeyBytes = hexToBytes(privateKey.slice(2));
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false); // uncompressed
  const publicKeyHex = bytesToHex(publicKeyBytes);

  // Generate Ed25519 keypair (for IROH)
  const ed25519PrivateKey = ed25519.utils.randomPrivateKey();
  const ed25519PublicKey = ed25519.getPublicKey(ed25519PrivateKey);

  // Create the identity object
  const identity: UnifiedIdentity = {
    secp256k1: {
      privateKey: privateKey.slice(2), // Remove 0x prefix
      publicKey: publicKeyHex,
      ethereumAddress: account.address,
    },
    ed25519: {
      privateKey: bytesToHex(ed25519PrivateKey),
      publicKey: bytesToHex(ed25519PublicKey),
      nodeId: bytesToHex(ed25519PublicKey), // In IROH, NodeID is the public key
    },
    magnetLink: '',
  };

  // Generate magnet link
  identity.magnetLink = encodeIdentity(identity);

  return identity;
}

/**
 * Encode identity into a magnet link format
 * Format: magnet:?xt=urn:identity:v1&secp256k1pub=...&ed25519pub=...
 */
export function encodeIdentity(identity: UnifiedIdentity): string {
  const params = new URLSearchParams({
    xt: 'urn:identity:v1',
    secp256k1pub: identity.secp256k1.publicKey,
    ed25519pub: identity.ed25519.publicKey,
    eth: identity.secp256k1.ethereumAddress,
  });

  return `magnet:?${params.toString()}`;
}

/**
 * Decode a magnet link back into public identity information
 * Note: Private keys are never included in magnet links
 */
export function decodeIdentity(magnetLink: string): Omit<UnifiedIdentity, 'magnetLink'> | null {
  try {
    const url = new URL(magnetLink);

    if (url.protocol !== 'magnet:') {
      throw new Error('Invalid protocol');
    }

    const params = new URLSearchParams(url.search.slice(1)); // Remove leading ?

    const xt = params.get('xt');
    if (xt !== 'urn:identity:v1') {
      throw new Error('Unsupported identity version');
    }

    const secp256k1pub = params.get('secp256k1pub');
    const ed25519pub = params.get('ed25519pub');
    const eth = params.get('eth');

    if (!secp256k1pub || !ed25519pub || !eth) {
      throw new Error('Missing required identity parameters');
    }

    return {
      secp256k1: {
        privateKey: '', // Not included in magnet link
        publicKey: secp256k1pub,
        ethereumAddress: eth,
      },
      ed25519: {
        privateKey: '', // Not included in magnet link
        publicKey: ed25519pub,
        nodeId: ed25519pub,
      },
    };
  } catch (error) {
    console.error('Failed to decode identity:', error);
    return null;
  }
}

/**
 * Get Ethereum account from the identity (for XMTP V3)
 */
export function getEthereumAccount(identity: UnifiedIdentity) {
  return privateKeyToAccount(`0x${identity.secp256k1.privateKey}` as `0x${string}`);
}

/**
 * Get Nostr keypair from the identity (for sending messages)
 */
export function getNostrKeys(identity: UnifiedIdentity): { privateKey: Uint8Array; publicKey: string } {
  // Nostr uses the same secp256k1 keys, but in different format
  // We need to convert from Ethereum format to Nostr format
  const privateKeyBytes = hexToBytes(identity.secp256k1.privateKey);
  const publicKey = getNostrPublicKey(privateKeyBytes);

  return {
    privateKey: privateKeyBytes,
    publicKey,
  };
}

/**
 * Get Nostr public key only (for addressing recipients)
 */
export function getNostrPublicKeyFromIdentity(identity: Omit<UnifiedIdentity, 'magnetLink'>): string {
  // Derive Nostr public key from secp256k1 public key
  // Nostr uses the x-coordinate of the public key (32 bytes)
  const fullPublicKey = identity.secp256k1?.publicKey;

  if (!fullPublicKey) {
    throw new Error('secp256k1 public key not available in identity');
  }

  // If we have the full uncompressed key (04 prefix + 64 hex chars = 130 chars)
  if (fullPublicKey.startsWith('04') && fullPublicKey.length === 130) {
    // Take the x-coordinate (first 32 bytes after the 04 prefix)
    return fullPublicKey.slice(2, 66);
  }

  // If we have compressed key (02/03 prefix + 32 bytes = 66 chars)
  if ((fullPublicKey.startsWith('02') || fullPublicKey.startsWith('03')) && fullPublicKey.length === 66) {
    // For compressed keys, we need to uncompress first
    // For now, just use the key without prefix as an approximation
    return fullPublicKey.slice(2);
  }

  throw new Error('Invalid secp256k1 public key format');
}

/**
 * Get IROH keys from the identity
 */
export function getIrohKeys(identity: UnifiedIdentity): { privateKey: Uint8Array; publicKey: Uint8Array; nodeId: string } {
  return {
    privateKey: hexToBytes(identity.ed25519.privateKey),
    publicKey: hexToBytes(identity.ed25519.publicKey),
    nodeId: identity.ed25519.nodeId,
  };
}

/**
 * Get identifier for MQTT topics
 */
export function getMqttIdentifier(identity: UnifiedIdentity | Omit<UnifiedIdentity, 'magnetLink'>): string {
  // Use Nostr-style public key for MQTT topics (same as getNostrPublicKeyFromIdentity)
  return getNostrPublicKeyFromIdentity(identity);
}

/**
 * Get identifier for Waku content topics
 */
export function getWakuIdentifier(identity: UnifiedIdentity | Omit<UnifiedIdentity, 'magnetLink'>): string {
  // Use Nostr-style public key for Waku topics (same as MQTT)
  return getNostrPublicKeyFromIdentity(identity);
}

/**
 * Display identity information in a human-readable format
 */
export function displayIdentity(identity: UnifiedIdentity): void {
  console.log('🔑 Unified Identity\n');
  console.log('secp256k1 (XMTP, Nostr, Waku, MQTT):');
  console.log('  Public Key:', identity.secp256k1.publicKey);
  console.log('  Ethereum Address:', identity.secp256k1.ethereumAddress);
  console.log('');
  console.log('Ed25519 (IROH):');
  console.log('  Public Key:', identity.ed25519.publicKey);
  console.log('  Node ID:', identity.ed25519.nodeId);
  console.log('');
  console.log('📎 Magnet Link (share this):');
  console.log(identity.magnetLink);
  console.log('');
}
