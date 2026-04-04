/* eslint-disable */
/**
 * Status Command
 *
 * - status: Show connection and system status
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CLIProgram } from '../config.js';

export function statusCommand(program: CLIProgram): void {
  program
    .command('status')
    .description('Show connection and system status')
    .option('--json', 'Output as JSON')
    .action((options: { json: boolean }) => {
      try {
        const config = program.config;

        const status = {
          identity: {
            loggedIn: fs.existsSync(config.identityPath),
            path: config.identityPath,
          },
          network: {
            connected: false, // Would check actual connection in production
            supernode: config.supernodeUrl || 'Not configured',
            latency: null,
          },
          data: {
            dataDir: config.dataDir,
            cacheDir: config.cacheDir,
            postsCount: getJsonFileCount(path.join(config.dataDir, 'posts.json')),
            channelsCount: getJsonFileCount(path.join(config.dataDir, 'channels.json')),
            dmsCount: getJsonFileCount(path.join(config.dataDir, 'dms.json')),
          },
          system: {
            platform: process.platform,
            nodeVersion: process.version,
            memory: {
              total: formatBytes(os.totalmem()),
              free: formatBytes(os.freemem()),
              used: formatBytes(os.totalmem() - os.freemem()),
            },
            uptime: formatDuration(os.uptime() * 1000),
          },
        };
        
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }
        
        console.log('\nISC Status\n');
        console.log('Identity:');
        console.log(`  Logged in: ${status.identity.loggedIn ? 'Yes' : 'No'}`);
        if (status.identity.loggedIn) {
          console.log(`  Path: ${status.identity.path}`);
        }
        
        console.log('\nNetwork:');
        console.log(`  Connected: ${status.network.connected ? 'Yes' : 'No'}`);
        console.log(`  Supernode: ${status.network.supernode}`);
        
        console.log('\nData:');
        console.log(`  Posts: ${status.data.postsCount}`);
        console.log(`  Channels: ${status.data.channelsCount}`);
        console.log(`  DMs: ${status.data.dmsCount}`);
        
        console.log('\nSystem:');
        console.log(`  Platform: ${status.system.platform}`);
        console.log(`  Node: ${status.system.nodeVersion}`);
        console.log(`  Memory: ${status.system.memory.used} / ${status.system.memory.total}`);
        console.log(`  Uptime: ${status.system.uptime}`);
        console.log();
        
      } catch (error) {
        console.error('Failed to get status:', error);
        process.exit(1);
      }
    });
}

function getJsonFileCount(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data.length : 1;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
