/**
 * Feed Commands
 * 
 * - feed: View For You feed
 * - channel: View channel feed
 * - following: View following feed
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { CLIConfig } from '../config.js';

interface PostData {
  id: string;
  author: string;
  content: string;
  channelID: string;
  timestamp: number;
}

export function feedCommands(program: Command): void {
  const feed = program.command('feed').description('Feed viewing');

  // View For You feed
  feed
    .command('[channel]')
    .description('View For You feed or channel feed')
    .option('-l, --limit <n>', 'Number of posts to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (channel: string | undefined, options: { limit: string; json: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const limit = parseInt(options.limit, 10);
        
        const postsFile = path.join(config.dataDir, 'posts.json');
        
        if (!fs.existsSync(postsFile)) {
          console.log('No posts available');
          return;
        }
        
        let posts: PostData[] = JSON.parse(fs.readFileSync(postsFile, 'utf-8'));
        
        // Filter by channel if specified
        if (channel) {
          posts = posts.filter(p => p.channelID === channel);
        }
        
        // Sort by timestamp descending
        posts.sort((a, b) => b.timestamp - a.timestamp);
        
        // Limit results
        posts = posts.slice(0, limit);
        
        if (options.json) {
          console.log(JSON.stringify(posts, null, 2));
          return;
        }
        
        if (posts.length === 0) {
          console.log('No posts found');
          return;
        }
        
        console.log(`\n${channel ? `Channel: #${channel}` : 'For You Feed'} (${posts.length} posts)\n`);
        console.log('─'.repeat(60));
        
        for (const post of posts) {
          const date = new Date(post.timestamp).toLocaleString();
          console.log(`[${date}] @${post.author} in #${post.channelID}`);
          console.log(`  ${post.content}`);
          console.log(`  ID: ${post.id}`);
          console.log('─'.repeat(60));
        }
        
      } catch (error) {
        console.error('Failed to load feed:', error);
        process.exit(1);
      }
    });

  // Following feed
  feed
    .command('following')
    .description('View feed from users you follow')
    .option('-l, --limit <n>', 'Number of posts to show', '20')
    .action((options: { limit: string }) => {
      console.log('Following feed (not yet implemented)');
      console.log('Run: isc feed');
    });

  // Trending feed
  feed
    .command('trending')
    .description('View trending posts')
    .option('-l, --limit <n>', 'Number of posts to show', '10')
    .action((options: { limit: string }) => {
      console.log('Trending feed (not yet implemented)');
      console.log('Run: isc feed');
    });
}
