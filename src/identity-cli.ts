#!/usr/bin/env node
/**
 * Identity Management CLI
 *
 * Commands:
 * - create [label]       - Create a new identity
 * - list                 - List all identities
 * - show <index|id>      - Show details of an identity
 * - delete <index|id>    - Delete an identity
 */

import { IdentityStorage } from './identity-storage.js';
import { displayIdentity } from './identity.js';

function displayHelp() {
  console.log(`
Identity Management CLI

Usage: npm run identity <command> [options]

Commands:
  create [label]        Create a new identity with optional label
  list                  List all stored identities
  show <index|id>       Show details of a specific identity
  delete <index|id>     Delete an identity
  help                  Show this help message

Examples:
  npm run identity create "My Laptop"
  npm run identity list
  npm run identity show 0
  npm run identity delete abc123
`);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const storage = new IdentityStorage();

  switch (command) {
    case 'create': {
      const label = args[1];
      console.log('Creating new identity...\n');
      const stored = storage.createIdentity(label);

      console.log('✅ Identity created successfully!\n');
      console.log(`ID: ${stored.id}`);
      console.log(`Created: ${formatDate(stored.createdAt)}`);
      if (stored.label) {
        console.log(`Label: ${stored.label}`);
      }
      console.log('');
      displayIdentity(stored.identity);
      console.log('\nIdentity saved to disk.');
      console.log(`Run "npm run identity list" to see all identities.`);
      break;
    }

    case 'list': {
      const identities = storage.listIdentities();

      if (identities.length === 0) {
        console.log('No identities found.');
        console.log('Create one with: npm run identity create');
        break;
      }

      console.log(`\nFound ${identities.length} identit${identities.length === 1 ? 'y' : 'ies'}:\n`);
      console.log('Index | ID       | Created              | Label           | Magnet Link');
      console.log('─────────────────────────────────────────────────────────────────────────────────');

      identities.forEach((stored, index) => {
        const id = stored.id.substring(0, 8);
        const created = formatDate(stored.createdAt);
        const label = (stored.label || '-').substring(0, 15).padEnd(15);
        const magnet = stored.identity.magnetLink.substring(0, 50) + '...';
        console.log(`${String(index).padStart(5)} | ${id} | ${created} | ${label} | ${magnet}`);
      });

      console.log('\nRun "npm run identity show <index>" to see full details.');
      break;
    }

    case 'show': {
      const identifier = args[1];
      if (!identifier) {
        console.error('Error: Please specify an identity index or ID');
        console.error('Usage: npm run identity show <index|id>');
        process.exit(1);
      }

      let stored;
      if (/^\d+$/.test(identifier)) {
        // It's an index
        stored = storage.getIdentityByIndex(parseInt(identifier));
      } else {
        // It's an ID
        stored = storage.getIdentityById(identifier);
      }

      if (!stored) {
        console.error(`Error: Identity not found: ${identifier}`);
        process.exit(1);
      }

      console.log('\nIdentity Details:\n');
      console.log(`ID: ${stored.id}`);
      console.log(`Created: ${formatDate(stored.createdAt)}`);
      if (stored.label) {
        console.log(`Label: ${stored.label}`);
      }
      console.log('');
      displayIdentity(stored.identity);
      break;
    }

    case 'delete': {
      const identifier = args[1];
      if (!identifier) {
        console.error('Error: Please specify an identity index or ID');
        console.error('Usage: npm run identity delete <index|id>');
        process.exit(1);
      }

      let id;
      if (/^\d+$/.test(identifier)) {
        // It's an index
        const stored = storage.getIdentityByIndex(parseInt(identifier));
        if (!stored) {
          console.error(`Error: Identity not found at index: ${identifier}`);
          process.exit(1);
        }
        id = stored.id;
      } else {
        // It's an ID
        id = identifier;
      }

      const success = storage.deleteIdentity(id);
      if (success) {
        console.log(`✅ Identity deleted: ${id}`);
      } else {
        console.error(`Error: Failed to delete identity: ${id}`);
        process.exit(1);
      }
      break;
    }

    case 'help':
    case undefined:
      displayHelp();
      break;

    default:
      console.error(`Error: Unknown command: ${command}`);
      displayHelp();
      process.exit(1);
  }
}

main().catch(console.error);
