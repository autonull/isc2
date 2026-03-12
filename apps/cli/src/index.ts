#!/usr/bin/env node

/**
 * ISC CLI - Command Line Interface for ISC
 *
 * References: NEXT_STEPS.md#cli-application
 */

import { Command } from 'commander';
import { loadConfig, ensureDataDirs } from './config.js';
import { identityCommands } from './commands/identity.js';
import { postCommands } from './commands/post.js';
import { feedCommands } from './commands/feed.js';
import { channelCommands } from './commands/channel.js';
import { dmCommands } from './commands/dm.js';
import { callCommands } from './commands/call.js';
import { statusCommand } from './commands/status.js';
import { configCommands } from './commands/config.js';
import { announceCommands } from './commands/announce.js';
import { queryCommands } from './commands/query.js';
import { supernodeCommands } from './commands/supernode.js';
import { initCommand } from './commands/init.js';
import type { CLIConfig } from './config.js';

const VERSION = '0.1.0';

function main(): void {
  const program = new Command();

  program
    .name('isc')
    .description('ISC - Internet Semantic Connect CLI')
    .version(VERSION)
    .option('-v, --verbose', 'Enable verbose output', false)
    .option('-c, --config <path>', 'Path to config file', './isc-config.json')
    .hook('preAction', (thisCommand, actionCommand) => {
      // Load config before each command
      const configPath = thisCommand.opts().config;
      const config = loadConfig(configPath);
      ensureDataDirs(config);
      (program as any).config = config;
    });

  // Register command groups
  identityCommands(program);
  postCommands(program);
  feedCommands(program);
  channelCommands(program);
  dmCommands(program);
  callCommands(program);
  statusCommand(program);
  configCommands(program);
  announceCommands(program);
  queryCommands(program);
  supernodeCommands(program);
  initCommand(program);

  program.parse(process.argv);

  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

main();
