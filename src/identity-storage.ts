/**
 * Identity Storage System
 *
 * Persists identities to disk for reuse across sessions
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UnifiedIdentity } from './identity.js';
import { generateIdentity } from './identity.js';

export interface StoredIdentity {
  id: string;
  createdAt: number;
  identity: UnifiedIdentity;
  label?: string;
}

export class IdentityStorage {
  private storageDir: string;

  constructor(storageDir: string = './data/identities') {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Create and save a new identity
   */
  createIdentity(label?: string): StoredIdentity {
    const identity = generateIdentity();
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);

    const stored: StoredIdentity = {
      id,
      createdAt: Date.now(),
      identity,
      label,
    };

    this.saveIdentity(stored);
    return stored;
  }

  /**
   * Save an identity to disk
   */
  private saveIdentity(stored: StoredIdentity): void {
    const filename = `${stored.createdAt}-${stored.id}.json`;
    const filepath = join(this.storageDir, filename);
    writeFileSync(filepath, JSON.stringify(stored, null, 2));
  }

  /**
   * List all stored identities
   */
  listIdentities(): StoredIdentity[] {
    if (!existsSync(this.storageDir)) {
      return [];
    }

    const files = readdirSync(this.storageDir)
      .filter(f => f.endsWith('.json'))
      .sort(); // Sort by filename (which starts with timestamp)

    return files.map(file => {
      const filepath = join(this.storageDir, file);
      const data = readFileSync(filepath, 'utf-8');
      return JSON.parse(data) as StoredIdentity;
    });
  }

  /**
   * Get identity by index (0 = oldest/first)
   */
  getIdentityByIndex(index: number): StoredIdentity | undefined {
    const identities = this.listIdentities();
    return identities[index];
  }

  /**
   * Get identity by ID
   */
  getIdentityById(id: string): StoredIdentity | undefined {
    const identities = this.listIdentities();
    return identities.find(i => i.id === id);
  }

  /**
   * Get the first (oldest) identity, or create one if none exist
   */
  getOrCreateFirstIdentity(): StoredIdentity {
    const identities = this.listIdentities();
    if (identities.length === 0) {
      console.log('No identities found, creating new one...');
      return this.createIdentity('Default Identity');
    }
    return identities[0];
  }

  /**
   * Delete an identity
   */
  deleteIdentity(id: string): boolean {
    const identities = this.listIdentities();
    const identity = identities.find(i => i.id === id);

    if (!identity) {
      return false;
    }

    const files = readdirSync(this.storageDir);
    for (const file of files) {
      if (file.includes(id)) {
        const filepath = join(this.storageDir, file);
        const fs = require('node:fs');
        fs.unlinkSync(filepath);
        return true;
      }
    }

    return false;
  }
}
