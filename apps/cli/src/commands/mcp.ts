/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
/**
 * MCP Command - Model Context Protocol interface for ISC
 *
 * Enables AI agents to interact with the ISC network via stdio transport.
 */

import { Command } from 'commander';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClientNetworkService } from '@isc/network';
import { createStorage } from '@isc/adapters';
import type { CLIConfig } from '../config.js';

export function mcpCommands(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP server for agent communication')
    .action(async () => {
      const config = (program as any).config as CLIConfig;

      // Capture original streams
      const realStdoutWrite = process.stdout.write.bind(process.stdout);
      const realStderrWrite = process.stderr.write.bind(process.stderr);

      // Redirect all console methods to stderr to keep stdout clean for the MCP protocol
      const logToStderr = (level: string, ...args: any[]) => {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        realStderrWrite(`[${level}] ${message}\n`);
      };

      console.log = (...args) => logToStderr('INFO', ...args);
      console.info = (...args) => logToStderr('INFO', ...args);
      console.warn = (...args) => logToStderr('WARN', ...args);
      console.error = (...args) => logToStderr('ERROR', ...args);

      // Globally override console for the entire process
      (global as any).console = console;

      // Only redirect stdout.write IF it doesn't look like MCP protocol
      // This prevents 3rd party libraries from corrupting the MCP pipe.
      (process.stdout as any).write = (chunk: any, encoding?: any, callback?: any) => {
        const s = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : '';
        // MCP transport uses JSON.stringify + \n. If it looks like JSON-RPC, allow it.
        if (s.includes('"jsonrpc":"2.0"') || (s.startsWith('{') && s.includes('"id":'))) {
          return realStdoutWrite(chunk, encoding, callback);
        }
        return realStderrWrite(chunk, encoding, callback);
      };

      try {
        // Initialize ISC network service
        const network = createClientNetworkService({
          storage: createStorage(config.dataDir),
          autoDiscover: true
        });

        const transport = new StdioServerTransport();

        const server = new Server(
          {
            name: 'isc-mcp-server',
            version: '0.1.0',
          },
          {
            capabilities: {
              resources: {},
              tools: {},
              prompts: {},
            },
          }
        );

        // --- Resources ---
        server.setRequestHandler(ListResourcesRequestSchema, async () => ({
          resources: [
            {
              uri: 'isc://identity',
              name: 'ISC Identity',
              mimeType: 'application/json',
              description: 'Current ISC peer identity and social profile',
            },
            {
              uri: 'isc://channels',
              name: 'ISC Channels',
              mimeType: 'application/json',
              description: 'List of all joined semantic channels',
            },
            {
              uri: 'isc://peers',
              name: 'ISC Peers',
              mimeType: 'application/json',
              description: 'List of discovered peer matches in the semantic network',
            },
          ],
        }));

        server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
          const uri = request.params.uri;

          if (uri === 'isc://identity') {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(network.getIdentity(), null, 2),
                },
              ],
            };
          }

          if (uri === 'isc://channels') {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(network.getChannels(), null, 2),
                },
              ],
            };
          }

          if (uri === 'isc://peers') {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(network.getMatches(), null, 2),
                },
              ],
            };
          }

          if (uri.startsWith('isc://posts/')) {
            const channelId = uri.split('/').pop() || '';
            const posts = network.getPosts(channelId);
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(posts, null, 2),
                },
              ],
            };
          }

          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
        });

        // --- Tools ---
        server.setRequestHandler(ListToolsRequestSchema, async () => ({
          tools: [
            {
              name: 'get_identity',
              description: 'Get current ISC identity and peer information',
              inputSchema: { type: 'object', properties: {} },
            },
            {
              name: 'update_identity',
              description: 'Update the current user identity name and bio',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'New name for the identity' },
                  bio: { type: 'string', description: 'New bio/description for the identity' },
                },
              },
            },
            {
              name: 'create_channel',
              description: 'Create a new semantic channel with a given name and description',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the channel' },
                  description: { type: 'string', description: 'Semantic description used for vector placement in the network' },
                  relations: {
                    type: 'array',
                    description: 'Optional semantic relations to other topics or objects',
                    items: {
                      type: 'object',
                      properties: {
                        tag: { type: 'string' },
                        object: { type: 'string' },
                        weight: { type: 'number' },
                      },
                      required: ['tag', 'object'],
                    },
                  },
                },
                required: ['name', 'description'],
              },
            },
            {
              name: 'update_channel',
              description: 'Update an existing channel name, description, or relations',
              inputSchema: {
                type: 'object',
                properties: {
                  channelId: { type: 'string', description: 'ID of the channel to update' },
                  name: { type: 'string', description: 'New name for the channel' },
                  description: { type: 'string', description: 'New semantic description for the channel' },
                  relations: {
                    type: 'array',
                    description: 'Updated semantic relations',
                    items: {
                      type: 'object',
                      properties: {
                        tag: { type: 'string' },
                        object: { type: 'string' },
                        weight: { type: 'number' },
                      },
                      required: ['tag', 'object'],
                    },
                  },
                },
                required: ['channelId'],
              },
            },
            {
              name: 'delete_channel',
              description: 'Delete a channel and its associated posts',
              inputSchema: {
                type: 'object',
                properties: {
                  channelId: { type: 'string', description: 'ID of the channel to delete' },
                },
                required: ['channelId'],
              },
            },
            {
              name: 'create_post',
              description: 'Create a new post in an existing channel',
              inputSchema: {
                type: 'object',
                properties: {
                  channelId: { type: 'string', description: 'Unique ID of the channel to post in' },
                  content: { type: 'string', description: 'The text content of the post' },
                },
                required: ['channelId', 'content'],
              },
            },
            {
              name: 'delete_post',
              description: 'Delete a post by ID',
              inputSchema: {
                type: 'object',
                properties: {
                  postId: { type: 'string', description: 'ID of the post to delete' },
                },
                required: ['postId'],
              },
            },
            {
              name: 'like_post',
              description: 'Like a post by ID',
              inputSchema: {
                type: 'object',
                properties: {
                  postId: { type: 'string', description: 'ID of the post to like' },
                },
                required: ['postId'],
              },
            },
            {
              name: 'set_channel_lurk_mode',
              description: 'Set whether a channel is in lurk mode (lurker channels do not affect your semantic position)',
              inputSchema: {
                type: 'object',
                properties: {
                  channelId: { type: 'string', description: 'ID of the channel' },
                  isLurker: { type: 'boolean', description: 'Whether the channel should be in lurk mode' },
                },
                required: ['channelId', 'isLurker'],
              },
            },
            {
              name: 'query_peers',
              description: 'Discover peers on the network with matching semantic interests',
              inputSchema: {
                type: 'object',
                properties: {
                  threshold: { type: 'number', description: 'Similarity threshold (0.0 to 1.0)', default: 0.4 },
                },
              },
            },
            {
              name: 'clear_cache',
              description: 'Clear all locally cached channels, posts, and peer matches',
              inputSchema: { type: 'object', properties: {} },
            },
            {
              name: 'fetch_posts',
              description: 'Fetch latest posts for a specific channel, including performing network discovery for new messages',
              inputSchema: {
                type: 'object',
                properties: {
                  channelId: { type: 'string', description: 'ID of the channel to fetch messages for' },
                },
                required: ['channelId'],
              },
            },
          ],
        }));

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
          const { name, arguments: args } = request.params;

          switch (name) {
            case 'get_identity': {
              return {
                content: [{ type: 'text', text: JSON.stringify(network.getIdentity(), null, 2) }],
              };
            }
            case 'update_identity': {
              await network.updateIdentity({
                name: args?.name as string,
                bio: args?.bio as string,
              });
              return {
                content: [{ type: 'text', text: 'Identity updated successfully' }],
              };
            }
            case 'create_channel': {
              const channel = await network.createChannel(
                args?.name as string,
                args?.description as string,
                { relations: args?.relations as any }
              );
              return {
                content: [{ type: 'text', text: `Channel created: ${channel.id} (${channel.name})` }],
              };
            }
            case 'update_channel': {
              const channel = await network.updateChannel(
                args?.channelId as string,
                {
                  name: args?.name as string,
                  description: args?.description as string,
                  relations: args?.relations as any,
                }
              );
              return {
                content: [{ type: 'text', text: `Channel updated: ${channel.id}` }],
              };
            }
            case 'delete_channel': {
              await network.deleteChannel(args?.channelId as string);
              return {
                content: [{ type: 'text', text: `Channel deleted: ${args?.channelId}` }],
              };
            }
            case 'create_post': {
              const post = await network.createPost(
                args?.channelId as string,
                args?.content as string
              );
              return {
                content: [{ type: 'text', text: `Post created: ${post.id}` }],
              };
            }
            case 'delete_post': {
              await network.deletePost(args?.postId as string);
              return {
                content: [{ type: 'text', text: `Post deleted: ${args?.postId}` }],
              };
            }
            case 'like_post': {
              await network.likePost(args?.postId as string);
              return {
                content: [{ type: 'text', text: `Post liked: ${args?.postId}` }],
              };
            }
            case 'set_channel_lurk_mode': {
              await network.setChannelLurkMode(
                args?.channelId as string,
                args?.isLurker as boolean
              );
              return {
                content: [{ type: 'text', text: `Lurk mode for channel ${args?.channelId} set to ${args?.isLurker}` }],
              };
            }
            case 'query_peers': {
              const matches = await network.discoverPeers();
              return {
                content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
              };
            }
            case 'clear_cache': {
              await network.clearCache();
              return {
                content: [{ type: 'text', text: 'Cache cleared successfully' }],
              };
            }
            case 'fetch_posts': {
              const channelId = args?.channelId as string;
              const channel = network.getChannels().find(c => c.id === channelId);
              if (!channel) {
                throw new McpError(ErrorCode.InvalidParams, `Channel not found: ${channelId}`);
              }
              const posts = await network.fetchMessagesForChannel(channel);
              return {
                content: [{ type: 'text', text: JSON.stringify(posts, null, 2) }],
              };
            }
            default:
              throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
          }
        });

        // --- Prompts ---
        server.setRequestHandler(ListPromptsRequestSchema, async () => ({
          prompts: [
            {
              name: 'semantic_search',
              description: 'Assists in finding relevant content or peers on ISC based on a semantic query',
              arguments: [
                {
                  name: 'query',
                  description: 'The topic or concept you are looking for',
                  required: true,
                },
              ],
            },
            {
              name: 'setup_profile',
              description: 'Guide for setting up or updating your ISC identity and bio',
              arguments: [
                {
                  name: 'name',
                  description: 'Desired display name',
                  required: false,
                },
                {
                  name: 'bio',
                  description: 'A description of your interests, which will be used for semantic positioning in the network',
                  required: false,
                },
              ],
            },
          ],
        }));

        server.setRequestHandler(GetPromptRequestSchema, async (request) => {
          const { name, arguments: args } = request.params;

          if (name === 'semantic_search') {
            const query = args?.query;
            return {
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: `I am looking for content on the ISC network related to: "${query}".

Instructions:
1. Use 'create_channel' to create a semantic entry point for this query. Provide a clear name and a detailed description that captures the essence of what you're looking for.
2. Once the channel is created, use 'fetch_posts' with the new channel ID to discover existing content in that semantic neighborhood.
3. You can also use 'query_peers' to find other users with similar interests.
4. If you find relevant posts, you can 'like_post' or reply by using 'create_post'.`,
                  },
                },
              ],
            };
          }

          if (name === 'setup_profile') {
            const userName = args?.name || 'an AI agent';
            const userBio = args?.bio || 'interested in semantic collaboration and distributed intelligence';
            return {
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: `I want to set up my ISC identity. My name is "${userName}" and my interests are: "${userBio}".

Instructions:
1. Use 'update_identity' with the provided name and bio.
2. Your bio is crucial because it determines your position in the semantic space of the network, allowing you to discover like-minded peers.
3. After updating, use 'get_identity' to verify your profile.
4. You can then use 'query_peers' to see who is nearby in the semantic network.`,
                  },
                },
              ],
            };
          }

          throw new McpError(ErrorCode.MethodNotFound, `Unknown prompt: ${name}`);
        });

        await server.connect(transport);
        console.info('MCP server connected to transport');

        console.info('Initializing ISC Network...');
        await network.initialize();
        console.info('ISC Network initialized');
      } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
      }
    });
}
