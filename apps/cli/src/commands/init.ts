/* eslint-disable */
/**
 * Init Command
 *
 * Initializes CLI with identity and default configuration
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { generateKeypair, exportKeypair } from '@isc/core';
import type { CLIConfig } from '../config.js';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize ISC CLI with identity and configuration')
    .option('--data-dir <path>', 'Data directory', './isc-data')
    .option('--cache-dir <path>', 'Cache directory', './isc-cache')
    .option('--config-path <path>', 'Config file path', './isc-config.json')
    .action(async (options: { dataDir: string; cacheDir: string; configPath: string }) => {
      try {
        console.log('\n🚀 Initializing ISC CLI\n');

        // Create directories
        console.log('1. Creating directories...');
        if (!fs.existsSync(options.dataDir)) {
          fs.mkdirSync(options.dataDir, { recursive: true });
          console.log(`   ✓ Created data directory: ${options.dataDir}`);
        } else {
          console.log(`   ✓ Data directory exists: ${options.dataDir}`);
        }

        if (!fs.existsSync(options.cacheDir)) {
          fs.mkdirSync(options.cacheDir, { recursive: true });
          console.log(`   ✓ Created cache directory: ${options.cacheDir}`);
        } else {
          console.log(`   ✓ Cache directory exists: ${options.cacheDir}`);
        }

        // Create config
        console.log('\n2. Creating configuration...');
        const config: CLIConfig = {
          identityPath: path.join(options.dataDir, 'identity.json'),
          dataDir: options.dataDir,
          cacheDir: options.cacheDir,
          connectTimeout: 5000,
          defaultFeedLimit: 20,
          colors: true,
        };

        fs.writeFileSync(options.configPath, JSON.stringify(config, null, 2));
        console.log(`   ✓ Config saved: ${options.configPath}`);

        // Generate identity
        console.log('\n3. Generating identity...');
        const keypair = await generateKeypair();
        const exported = await exportKeypair(keypair);

        const identityData = {
          peerID: `cli-peer-${Date.now()}`,
          publicKey: Array.from(exported.publicKey),
          privateKey: Array.from(exported.privateKey),
          createdAt: Date.now(),
        };

        fs.writeFileSync(config.identityPath, JSON.stringify(identityData, null, 2));
        console.log(`   ✓ Identity saved: ${config.identityPath}`);

        // Generate fingerprint
        const fingerprint = exported.publicKey.slice(0, 16).reduce((acc, byte) => {
          return acc + byte.toString(16).padStart(2, '0');
        }, '');

        console.log('\n4. Identity fingerprint:');
        console.log(`   ${fingerprint.match(/.{1,4}/g)?.join(':')}`);

        console.log('\n✅ Initialization complete!\n');
        console.log('Next steps:');
        console.log('   1. Create a channel: isc channel create "My Channel" -d "Description"');
        console.log('   2. Announce to DHT:  isc announce channel "My Channel"');
        console.log('   3. Query matches:    isc query semantic');
        console.log('   4. Start supernode:  isc supernode start --port 3000');
        console.log();

      } catch (error) {
        console.error('\n❌ Initialization failed:', error);
        process.exit(1);
      }
    });
}
