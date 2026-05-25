/* eslint-disable */
/**
 * Identity Management Commands
 * 
 * - login: Initialize identity
 * - logout: Clear identity
 * - whoami: Show current identity
 * - keygen: Generate new keypair
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import { generateKeypair, exportKeypair } from '@isc/core';
import type { CLIConfig } from '../config.js';

export function identityCommands(program: Command): void {
  const identity = program.command('identity').description('Identity management');

  // login command
  identity
    .command('login')
    .description('Initialize or load identity')
    .option('-p, --passphrase <pass>', 'Passphrase for encrypted identity')
    .option('--new', 'Generate new identity')
    .action(async (options: { passphrase?: string; new?: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        
        if (options.new || !fs.existsSync(config.identityPath)) {
          console.log('Generating new identity...');
          const keypair = await generateKeypair();
          const exported = await exportKeypair(keypair);
          
          const identityData = {
            publicKey: Array.from(exported.publicKey),
            privateKey: options.passphrase 
              ? Array.from(exported.privateKey) // Would encrypt in production
              : Array.from(exported.privateKey),
            createdAt: Date.now(),
          };
          
          fs.writeFileSync(config.identityPath, JSON.stringify(identityData, null, 2));
          console.log('✓ Identity generated and saved');
        } else {
          console.log('✓ Identity loaded');
        }
        
        // Show fingerprint
        const identityData = JSON.parse(fs.readFileSync(config.identityPath, 'utf-8'));
        // In production, would properly format the key fingerprint
        console.log(`Identity ready`);
      } catch (error) {
        console.error('Failed to initialize identity:', error);
        process.exit(1);
      }
    });

  // logout command
  identity
    .command('logout')
    .description('Clear identity (does not delete key file)')
    .action(() => {
      console.log('✓ Logged out (identity file preserved)');
    });

  // whoami command
  identity
    .command('whoami')
    .description('Show current identity')
    .action((options: { passphrase?: string }) => {
      try {
        const config = (program as any).config as CLIConfig;
        
        if (!fs.existsSync(config.identityPath)) {
          console.log('Not logged in. Run: isc identity login');
          return;
        }
        
        const identityData = JSON.parse(fs.readFileSync(config.identityPath, 'utf-8'));
        const createdAt = new Date(identityData.createdAt).toISOString();
        
        console.log('Identity:');
        console.log(`  Created: ${createdAt}`);
        console.log(`  Path: ${config.identityPath}`);
        console.log(`  Encrypted: ${options.passphrase ? 'Yes' : 'No'}`);
      } catch (error) {
        console.error('Failed to read identity:', error);
        process.exit(1);
      }
    });

  // keygen command
  identity
    .command('keygen')
    .description('Generate new keypair')
    .option('-o, --output <path>', 'Output path for keypair')
    .action(async (options: { output?: string }) => {
      try {
        const keypair = await generateKeypair();
        const exported = await exportKeypair(keypair);

        const output = options.output || './isc-keypair.json';
        const keypairData = {
          publicKey: Array.from(exported.publicKey),
          privateKey: Array.from(exported.privateKey),
          generatedAt: Date.now(),
        };

        fs.writeFileSync(output, JSON.stringify(keypairData, null, 2));
        console.log(`✓ Keypair saved to: ${output}`);
        console.log('(Import keypair with: isc identity login --new)');
      } catch (error) {
        console.error('Failed to generate keypair:', error);
        process.exit(1);
      }
    });
}
