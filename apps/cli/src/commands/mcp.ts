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
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        realStderrWrite(`[${level}] ${message}\n`);
      };

      console.log = (...args) => logToStderr('INFO', ...args);
      console.info = (...args) => logToStderr('INFO', ...args);
      console.warn = (...args) => logToStderr('WARN', ...args);
      console.error = (...args) => logToStderr('ERROR', ...args);

      // Globally override console for the entire process
      (global as any).console = console;

      // Patch process.stdout.write to redirect anything that isn't JSON-RPC to stderr.
      // This prevents 3rd party libraries from corrupting the MCP pipe.
      process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
        const s = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
        if (s.includes('"jsonrpc":"2.0"')) {
           return realStdoutWrite(chunk, encoding, callback);
        }
        return realStderrWrite(chunk, encoding, callback);
      } as any;

      try {
        // Initialize ISC network service
        const network = createClientNetworkService({
          storage: createStorage(config.dataDir),
          autoDiscover: true
        });

        await network.initialize();
        console.info('ISC Network initialized');

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
              name: 'create_channel',
              description: 'Create a new semantic channel with a given name and description',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the channel' },
                  description: { type: 'string', description: 'Semantic description used for vector placement in the network' },
                },
                required: ['name', 'description'],
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
            case 'create_channel': {
              const channel = await network.createChannel(
                args?.name as string,
                args?.description as string
              );
              return {
                content: [{ type: 'text', text: `Channel created: ${channel.id} (${channel.name})` }],
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
            case 'query_peers': {
              const matches = await network.discoverPeers();
              return {
                content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
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
          ],
        }));

        server.setRequestHandler(GetPromptRequestSchema, async (request) => {
          if (request.params.name === 'semantic_search') {
            const query = request.params.arguments?.query;
            return {
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: `I am looking for content on the ISC network related to: "${query}".
Please use the 'create_channel' tool with a descriptive name and semantic description based on this query to explore the network, then 'fetch_posts' to see the messages in that semantic neighborhood.`,
                  },
                },
              ],
            };
          }
          throw new McpError(ErrorCode.MethodNotFound, `Unknown prompt: ${request.params.name}`);
        });

        const transport = new StdioServerTransport();
        await server.connect(transport);

        console.info('MCP server connected to transport');
      } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
      }
    });
}
