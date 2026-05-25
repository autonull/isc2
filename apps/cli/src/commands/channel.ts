/* eslint-disable */
/**
 * Channel Commands
 * 
 * - channel create: Create new channel
 * - channel list: List channels
 * - channel join: Join channel
 * - channel leave: Leave channel
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { CLIConfig } from '../config.js';

interface ChannelData {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  members: string[];
}

export function channelCommands(program: Command): void {
  const channel = program.command('channel').description('Channel management').alias('ch');

  // Create channel
  channel
    .command('create <name>')
    .description('Create a new channel')
    .option('-d, --description <desc>', 'Channel description', '')
    .option('--private', 'Make channel private', false)
    .action((name: string, options: { description: string; private: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        
        const channelsFile = path.join(config.dataDir, 'channels.json');
        let channels: ChannelData[] = [];
        
        if (fs.existsSync(channelsFile)) {
          channels = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));
        }
        
        // Check if channel exists
        if (channels.some(c => c.name === name)) {
          console.error(`Channel #${name} already exists`);
          process.exit(1);
        }
        
        const newChannel: ChannelData = {
          id: `channel_${crypto.randomUUID()}`,
          name,
          description: options.description,
          createdAt: Date.now(),
          members: ['local-user'], // Creator is first member
        };
        
        channels.push(newChannel);
        fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2));
        
        console.log('✓ Channel created');
        console.log(`  Name: #${name}`);
        console.log(`  ID: ${newChannel.id}`);
        if (options.description) {
          console.log(`  Description: ${options.description}`);
        }
        console.log(`  Private: ${options.private ? 'Yes' : 'No'}`);
        
      } catch (error) {
        console.error('Failed to create channel:', error);
        process.exit(1);
      }
    });

  // List channels
  channel
    .command('list')
    .alias('ls')
    .description('List all channels')
    .option('--json', 'Output as JSON')
    .action((options: { json: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const channelsFile = path.join(config.dataDir, 'channels.json');
        
        if (!fs.existsSync(channelsFile)) {
          console.log('No channels found');
          return;
        }
        
        const channels: ChannelData[] = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));
        
        if (options.json) {
          console.log(JSON.stringify(channels, null, 2));
          return;
        }
        
        console.log(`\nChannels (${channels.length})\n`);
        
        for (const ch of channels) {
          const memberCount = ch.members.length;
          const date = new Date(ch.createdAt).toLocaleDateString();
          console.log(`  #${ch.name}`);
          console.log(`    ${ch.description || 'No description'}`);
          console.log(`    ${memberCount} member${memberCount !== 1 ? 's' : ''} • Created ${date}`);
          console.log();
        }
        
      } catch (error) {
        console.error('Failed to list channels:', error);
        process.exit(1);
      }
    });

  // Join channel
  channel
    .command('join <name>')
    .description('Join a channel')
    .action((name: string) => {
      try {
        const config = (program as any).config as CLIConfig;
        const channelsFile = path.join(config.dataDir, 'channels.json');
        
        if (!fs.existsSync(channelsFile)) {
          console.error('No channels found');
          process.exit(1);
        }
        
        let channels: ChannelData[] = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));
        const channel = channels.find(c => c.name === name);
        
        if (!channel) {
          console.error(`Channel #${name} not found`);
          process.exit(1);
        }
        
        if (channel.members.includes('local-user')) {
          console.log(`Already a member of #${name}`);
          return;
        }
        
        channel.members.push('local-user');
        fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2));
        
        console.log(`✓ Joined #${name}`);
        
      } catch (error) {
        console.error('Failed to join channel:', error);
        process.exit(1);
      }
    });

  // Leave channel
  channel
    .command('leave <name>')
    .description('Leave a channel')
    .action((name: string) => {
      try {
        const config = (program as any).config as CLIConfig;
        const channelsFile = path.join(config.dataDir, 'channels.json');
        
        if (!fs.existsSync(channelsFile)) {
          console.error('No channels found');
          process.exit(1);
        }
        
        let channels: ChannelData[] = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));
        const channel = channels.find(c => c.name === name);
        
        if (!channel) {
          console.error(`Channel #${name} not found`);
          process.exit(1);
        }
        
        const index = channel.members.indexOf('local-user');
        if (index === -1) {
          console.log(`Not a member of #${name}`);
          return;
        }
        
        channel.members.splice(index, 1);
        fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2));
        
        console.log(`✓ Left #${name}`);
        
      } catch (error) {
        console.error('Failed to leave channel:', error);
        process.exit(1);
      }
    });

  // Channel info
  channel
    .command('info <name>')
    .description('Show channel information')
    .action((name: string) => {
      try {
        const config = (program as any).config as CLIConfig;
        const channelsFile = path.join(config.dataDir, 'channels.json');
        
        if (!fs.existsSync(channelsFile)) {
          console.error('No channels found');
          process.exit(1);
        }
        
        const channels: ChannelData[] = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));
        const channel = channels.find(c => c.name === name);
        
        if (!channel) {
          console.error(`Channel #${name} not found`);
          process.exit(1);
        }
        
        const date = new Date(channel.createdAt).toLocaleString();
        
        console.log(`\nChannel: #${channel.name}`);
        console.log(`  ID: ${channel.id}`);
        console.log(`  Description: ${channel.description || 'No description'}`);
        console.log(`  Created: ${date}`);
        console.log(`  Members: ${channel.members.length}`);
        console.log(`  Private: No`);
        
      } catch (error) {
        console.error('Failed to get channel info:', error);
        process.exit(1);
      }
    });
}
