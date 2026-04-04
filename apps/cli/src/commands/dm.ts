/* eslint-disable */
/**
 * Direct Message Commands
 * 
 * - dm: Start/view DM
 * - dm send: Send DM
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { CLIConfig } from '../config.js';

interface DMMessage {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export function dmCommands(program: Command): void {
  const dm = program.command('dm').description('Direct messaging');

  // Start or view DM conversation
  dm
    .command('<peerId>')
    .description('Start or view DM conversation')
    .option('-l, --limit <n>', 'Number of messages to show', '20')
    .action((peerId: string, options: { limit: string }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const limit = parseInt(options.limit, 10);
        
        const dmsFile = path.join(config.dataDir, 'dms.json');
        
        if (!fs.existsSync(dmsFile)) {
          console.log(`No messages with @${peerId}`);
          console.log(`Send a message: isc dm ${peerId} send "Hello!"`);
          return;
        }
        
        const dms: DMMessage[] = JSON.parse(fs.readFileSync(dmsFile, 'utf-8'));
        
        // Filter messages with this peer
        const conversation = dms.filter(
          m => (m.sender === 'local-user' && m.recipient === peerId) ||
               (m.sender === peerId && m.recipient === 'local-user')
        );
        
        // Sort by timestamp
        conversation.sort((a, b) => b.timestamp - a.timestamp);
        
        // Limit results
        const messages = conversation.slice(0, limit).reverse();
        
        if (messages.length === 0) {
          console.log(`No messages with @${peerId}`);
          console.log(`Send a message: isc dm ${peerId} send "Hello!"`);
          return;
        }
        
        console.log(`\nConversation with @${peerId}\n`);
        console.log('─'.repeat(60));
        
        for (const msg of messages) {
          const date = new Date(msg.timestamp).toLocaleString();
          const isMe = msg.sender === 'local-user';
          console.log(`[${date}] ${isMe ? 'You' : '@' + msg.sender}:`);
          console.log(`  ${msg.content}`);
          console.log();
        }
        
      } catch (error) {
        console.error('Failed to load messages:', error);
        process.exit(1);
      }
    });

  // Send DM
  dm
    .command('send <peerId> <content>')
    .description('Send a direct message')
    .action((peerId: string, content: string) => {
      try {
        const config = (program as any).config as CLIConfig;
        const dmsFile = path.join(config.dataDir, 'dms.json');
        
        let dms: DMMessage[] = [];
        if (fs.existsSync(dmsFile)) {
          dms = JSON.parse(fs.readFileSync(dmsFile, 'utf-8'));
        }
        
        const newMessage: DMMessage = {
          id: `dm_${crypto.randomUUID()}`,
          sender: 'local-user',
          recipient: peerId,
          content,
          timestamp: Date.now(),
          read: false,
        };
        
        dms.push(newMessage);
        fs.writeFileSync(dmsFile, JSON.stringify(dms, null, 2));
        
        console.log('✓ Message sent');
        console.log(`  To: @${peerId}`);
        console.log(`  ${content}`);
        
      } catch (error) {
        console.error('Failed to send message:', error);
        process.exit(1);
      }
    });

  // List conversations
  dm
    .command('list')
    .alias('ls')
    .description('List DM conversations')
    .action(() => {
      try {
        const config = (program as any).config as CLIConfig;
        const dmsFile = path.join(config.dataDir, 'dms.json');
        
        if (!fs.existsSync(dmsFile)) {
          console.log('No conversations');
          return;
        }
        
        const dms: DMMessage[] = JSON.parse(fs.readFileSync(dmsFile, 'utf-8'));
        
        // Group by peer
        const conversations = new Map<string, { lastMessage: DMMessage; unread: number }>();
        
        for (const dm of dms) {
          const peer = dm.sender === 'local-user' ? dm.recipient : dm.sender;
          const existing = conversations.get(peer);
          
          if (!existing || dm.timestamp > existing.lastMessage.timestamp) {
            conversations.set(peer, {
              lastMessage: dm,
              unread: existing ? existing.unread : 0,
            });
          }
          
          if (dm.recipient === 'local-user' && !dm.read) {
            const current = conversations.get(peer);
            if (current) {
              current.unread++;
            }
          }
        }
        
        if (conversations.size === 0) {
          console.log('No conversations');
          return;
        }
        
        console.log('\nConversations\n');
        
        for (const [peer, { lastMessage, unread }] of conversations) {
          const date = new Date(lastMessage.timestamp).toLocaleString();
          const isMe = lastMessage.sender === 'local-user';
          const unreadIndicator = unread > 0 ? ` (${unread} new)` : '';
          
          console.log(`  @${peer}${unreadIndicator}`);
          console.log(`    ${date} - ${isMe ? 'You' : '@' + peer}: ${lastMessage.content.slice(0, 50)}...`);
          console.log();
        }
        
      } catch (error) {
        console.error('Failed to list conversations:', error);
        process.exit(1);
      }
    });
}
