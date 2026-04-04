/* eslint-disable */
/**
 * Configuration Commands
 * 
 * - config show: Show current config
 * - config set: Set config value
 * - config init: Initialize config file
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import type { CLIConfig } from '../config.js';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../config.js';

export function configCommands(program: Command): void {
  const config = program.command('config').description('Configuration management');

  // Show config
  config
    .command('show')
    .description('Show current configuration')
    .option('--json', 'Output as JSON')
    .action((options: { json: boolean }) => {
      try {
        const configPath = (program as any).opts().config || './isc-config.json';
        const currentConfig = loadConfig(configPath);
        
        if (options.json) {
          console.log(JSON.stringify(currentConfig, null, 2));
          return;
        }
        
        console.log('\nISC Configuration\n');
        console.log(`Config file: ${configPath}`);
        console.log('\nIdentity:');
        console.log(`  Path: ${currentConfig.identityPath}`);
        
        console.log('\nNetwork:');
        console.log(`  Supernode: ${currentConfig.supernodeUrl || 'Auto-discover'}`);
        console.log(`  Timeout: ${currentConfig.connectTimeout}ms`);
        
        console.log('\nDisplay:');
        console.log(`  Feed limit: ${currentConfig.defaultFeedLimit}`);
        console.log(`  Colors: ${currentConfig.colors ? 'Enabled' : 'Disabled'}`);
        
        console.log('\nData:');
        console.log(`  Data dir: ${currentConfig.dataDir}`);
        console.log(`  Cache dir: ${currentConfig.cacheDir}`);
        console.log();
        
      } catch (error) {
        console.error('Failed to show config:', error);
        process.exit(1);
      }
    });

  // Set config value
  config
    .command('set <key> <value>')
    .description('Set configuration value')
    .action((key: string, value: string) => {
      try {
        const configPath = (program as any).opts().config || './isc-config.json';
        const currentConfig = loadConfig(configPath);
        
        // Parse value
        let parsedValue: string | number | boolean = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        
        // Set value
        const configKeys = Object.keys(DEFAULT_CONFIG) as (keyof CLIConfig)[];
        if (!configKeys.includes(key as keyof CLIConfig)) {
          console.error(`Unknown config key: ${key}`);
          console.log(`Available keys: ${configKeys.join(', ')}`);
          process.exit(1);
        }
        
        (currentConfig as any)[key] = parsedValue;
        saveConfig(currentConfig, configPath);
        
        console.log(`✓ Set ${key} = ${parsedValue}`);
        
      } catch (error) {
        console.error('Failed to set config:', error);
        process.exit(1);
      }
    });

  // Initialize config
  config
    .command('init')
    .description('Initialize configuration file')
    .option('--force', 'Overwrite existing config')
    .action((options: { force: boolean }) => {
      try {
        const configPath = (program as any).opts().config || './isc-config.json';
        
        if (fs.existsSync(configPath) && !options.force) {
          console.log(`Config already exists: ${configPath}`);
          console.log('Use --force to overwrite');
          return;
        }
        
        saveConfig(DEFAULT_CONFIG, configPath);
        console.log(`✓ Config initialized: ${configPath}`);
        console.log('Edit with: isc config set <key> <value>');
        
      } catch (error) {
        console.error('Failed to initialize config:', error);
        process.exit(1);
      }
    });

  // Reset config
  config
    .command('reset')
    .description('Reset configuration to defaults')
    .option('--force', 'Skip confirmation')
    .action((options: { force: boolean }) => {
      try {
        const configPath = (program as any).opts().config || './isc-config.json';
        
        if (!fs.existsSync(configPath)) {
          console.log('No config file to reset');
          return;
        }
        
        if (!options.force) {
          console.log('This will reset all configuration to defaults.');
          console.log('Use --force to confirm');
          return;
        }
        
        saveConfig(DEFAULT_CONFIG, configPath);
        console.log('✓ Config reset to defaults');
        
      } catch (error) {
        console.error('Failed to reset config:', error);
        process.exit(1);
      }
    });
}
