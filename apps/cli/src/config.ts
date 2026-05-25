/* eslint-disable */
/**
 * CLI Configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';

export interface CLIConfig {
  // Identity
  identityPath: string;
  passphrase?: string;

  // Network
  supernodeUrl?: string;
  connectTimeout: number;

  // Display
  defaultFeedLimit: number;
  colors: boolean;

  // Paths
  dataDir: string;
  cacheDir: string;
}

export interface CLIProgram extends Command {
  config: CLIConfig;
}

const DEFAULT_CONFIG: CLIConfig = {
  identityPath: './isc-identity.json',
  connectTimeout: 5000,
  defaultFeedLimit: 20,
  colors: true,
  dataDir: './isc-data',
  cacheDir: './isc-cache',
};

export { DEFAULT_CONFIG };

/**
 * Load configuration from file
 */
export function loadConfig(configPath?: string): CLIConfig {
  const configPathToUse = configPath || './isc-config.json';
  
  try {
    if (fs.existsSync(configPathToUse)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPathToUse, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...fileConfig };
    }
  } catch (error) {
    console.warn(`Failed to load config from ${configPathToUse}:`, error);
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Save configuration to file
 */
export function saveConfig(config: CLIConfig, configPath: string): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Ensure data directories exist
 */
export function ensureDataDirs(config: CLIConfig): void {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
  if (!fs.existsSync(config.cacheDir)) {
    fs.mkdirSync(config.cacheDir, { recursive: true });
  }
}
