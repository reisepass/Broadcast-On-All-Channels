/**
 * User Manager
 *
 * Manages multiple user identities with:
 * - 3-word random names
 * - Separate storage per user
 * - User selection on startup
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { UnifiedIdentity } from './identity.js';
import { generateIdentity } from './identity.js';

// Word lists for generating user names (3-word combinations)
const ADJECTIVES = [
  'happy', 'bright', 'clever', 'swift', 'bold', 'calm', 'wise', 'kind',
  'brave', 'gentle', 'quick', 'sharp', 'wild', 'free', 'proud', 'silent',
  'eager', 'noble', 'royal', 'grand', 'cosmic', 'mystic', 'golden', 'silver'
];

const NOUNS = [
  'falcon', 'tiger', 'dragon', 'phoenix', 'wolf', 'eagle', 'lion', 'bear',
  'hawk', 'raven', 'deer', 'fox', 'otter', 'lynx', 'puma', 'cobra',
  'panther', 'jaguar', 'leopard', 'cheetah', 'thunder', 'storm', 'river', 'mountain'
];

const COLORS = [
  'blue', 'red', 'green', 'purple', 'orange', 'cyan', 'magenta', 'amber',
  'jade', 'ruby', 'pearl', 'onyx', 'coral', 'azure', 'crimson', 'indigo',
  'violet', 'scarlet', 'emerald', 'sapphire', 'topaz', 'ivory', 'ebony', 'silver'
];

export interface UserProfile {
  name: string; // 3-word name like "happy-blue-falcon"
  identity: UnifiedIdentity;
  createdAt: number;
  lastUsedAt: number;
}

export class UserManager {
  private usersDir: string;

  constructor(usersDir: string = './data/users') {
    this.usersDir = usersDir;
    this.ensureUsersDir();
  }

  private ensureUsersDir(): void {
    if (!existsSync(this.usersDir)) {
      mkdirSync(this.usersDir, { recursive: true });
    }
  }

  /**
   * Generate a random 3-word name
   */
  private generateUserName(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj}-${color}-${noun}`;
  }

  /**
   * Get path for a user's profile file
   */
  private getUserPath(userName: string): string {
    return join(this.usersDir, `${userName}.json`);
  }

  /**
   * Get path for a user's database
   */
  getUserDbPath(userName: string): string {
    return join(this.usersDir, `${userName}.db`);
  }

  /**
   * List all existing users
   */
  listUsers(): UserProfile[] {
    const files = readdirSync(this.usersDir).filter(f => f.endsWith('.json'));
    const users: UserProfile[] = [];

    for (const file of files) {
      try {
        const data = readFileSync(join(this.usersDir, file), 'utf-8');
        const user = JSON.parse(data) as UserProfile;
        users.push(user);
      } catch (error) {
        console.error(`Failed to load user ${file}:`, error);
      }
    }

    // Sort by last used (most recent first)
    return users.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  /**
   * Create a new user with a random 3-word name
   */
  createUser(): UserProfile {
    // Generate unique name
    let name = this.generateUserName();
    let attempts = 0;
    while (existsSync(this.getUserPath(name)) && attempts < 100) {
      name = this.generateUserName();
      attempts++;
    }

    if (attempts >= 100) {
      throw new Error('Failed to generate unique user name');
    }

    // Create new identity
    const identity = generateIdentity();

    const user: UserProfile = {
      name,
      identity,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    // Save to disk
    this.saveUser(user);

    return user;
  }

  /**
   * Load a user by name
   */
  loadUser(userName: string): UserProfile | null {
    const path = this.getUserPath(userName);
    if (!existsSync(path)) {
      return null;
    }

    try {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data) as UserProfile;
    } catch (error) {
      console.error(`Failed to load user ${userName}:`, error);
      return null;
    }
  }

  /**
   * Save or update a user profile
   */
  saveUser(user: UserProfile): void {
    const path = this.getUserPath(user.name);
    writeFileSync(path, JSON.stringify(user, null, 2));
  }

  /**
   * Update last used timestamp for a user
   */
  updateLastUsed(userName: string): void {
    const user = this.loadUser(userName);
    if (user) {
      user.lastUsedAt = Date.now();
      this.saveUser(user);
    }
  }

  /**
   * Delete a user
   */
  deleteUser(userName: string): boolean {
    const path = this.getUserPath(userName);
    if (!existsSync(path)) {
      return false;
    }

    try {
      const fs = require('fs');
      fs.unlinkSync(path);

      // Also delete user's database
      const dbPath = this.getUserDbPath(userName);
      if (existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete user ${userName}:`, error);
      return false;
    }
  }
}
