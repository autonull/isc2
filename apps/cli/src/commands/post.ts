/**
 * Post Commands
 * 
 * - post: Create new post
 * - delete: Delete a post
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

export function postCommands(program: Command): void {
  const post = program.command('post').description('Post management');

  // Create post command
  post
    .command('create <content>')
    .alias('new')
    .description('Create a new post')
    .option('-c, --channel <channel>', 'Channel ID to post in', 'general')
    .option('--json', 'Output as JSON')
    .action(async (content: string, options: { channel: string; json: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        
        // Check identity
        if (!fs.existsSync(config.identityPath)) {
          console.error('Not logged in. Run: isc identity login');
          process.exit(1);
        }
        
        const identityData = JSON.parse(fs.readFileSync(config.identityPath, 'utf-8'));
        
        const postData: Omit<PostData, 'signature'> = {
          id: `post_${crypto.randomUUID()}`,
          author: 'local-user', // Would be peerID in production
          content,
          channelID: options.channel,
          timestamp: Date.now(),
        };
        
        // In production, would sign and broadcast to network
        const signedPost = {
          ...postData,
          signature: 'unsigned', // Placeholder
        };
        
        if (options.json) {
          console.log(JSON.stringify(signedPost, null, 2));
        } else {
          console.log('✓ Post created');
          console.log(`  ID: ${signedPost.id}`);
          console.log(`  Channel: ${signedPost.channelID}`);
          console.log(`  Content: ${content}`);
        }
        
        // Store locally
        const postsFile = path.join(config.dataDir, 'posts.json');
        let posts: PostData[] = [];
        if (fs.existsSync(postsFile)) {
          posts = JSON.parse(fs.readFileSync(postsFile, 'utf-8'));
        }
        posts.push(postData);
        fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
        
      } catch (error) {
        console.error('Failed to create post:', error);
        process.exit(1);
      }
    });

  // Delete post command
  post
    .command('delete <postId>')
    .description('Delete a post')
    .option('--force', 'Skip confirmation')
    .action((postId: string, options: { force: boolean }) => {
      try {
        const config = (program as any).config as CLIConfig;
        const postsFile = path.join(config.dataDir, 'posts.json');
        
        if (!fs.existsSync(postsFile)) {
          console.error('No posts found');
          process.exit(1);
        }
        
        let posts: PostData[] = JSON.parse(fs.readFileSync(postsFile, 'utf-8'));
        const originalLength = posts.length;
        posts = posts.filter(p => p.id !== postId);
        
        if (posts.length === originalLength) {
          console.error(`Post not found: ${postId}`);
          process.exit(1);
        }
        
        if (!options.force) {
          console.log(`Delete post ${postId}? (y/N)`);
          // In production, would wait for confirmation
        }
        
        fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
        console.log('✓ Post deleted');

      } catch (error) {
        console.error('Failed to delete post:', error);
        process.exit(1);
      }
    });
}
