#!/usr/bin/env node
/**
 * ISC Terminal UI - Modern IRC-style Interface
 * 
 * Built with Ink (React for terminal)
 * Inspired by HexChat, irssi, WeeChat
 */

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp, Static } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

// Network imports
import {
  createEmbeddingService,
  createDHT,
  VirtualPeer,
  createIdentityService,
  createStorage,
  type PeerMatch,
} from '@isc/network';

// Data paths
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const DATA_DIR = join(process.cwd(), 'isc-data');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const CHANNELS_FILE = join(DATA_DIR, 'channels.json');
const POSTS_FILE = join(DATA_DIR, 'posts.json');
const MATCHES_FILE = join(DATA_DIR, 'matches.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Types
interface Config {
  identity: { name: string; bio: string };
  settings: { theme: 'dark' | 'light'; autoDiscover: boolean; discoverInterval: number };
}

interface Channel {
  id: string;
  name: string;
  description: string;
  embedding?: number[];
  createdAt: number;
}

interface Post {
  id: string;
  channelId: string;
  channelName: string;
  content: string;
  author: string;
  createdAt: number;
}

// Storage helpers
function loadConfig(): Config {
  const defaults: Config = {
    identity: { name: 'Anonymous', bio: 'ISC User' },
    settings: { theme: 'dark', autoDiscover: true, discoverInterval: 30 },
  };
  if (!existsSync(CONFIG_FILE)) {
    saveConfig(defaults);
    return defaults;
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return defaults;
  }
}

function saveConfig(config: Config): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function loadChannels(): Channel[] {
  if (!existsSync(CHANNELS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CHANNELS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveChannels(channels: Channel[]): void {
  writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

function loadPosts(channelId?: string): Post[] {
  if (!existsSync(POSTS_FILE)) return [];
  try {
    const all: Post[] = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
    return channelId ? all.filter(p => p.channelId === channelId) : all;
  } catch {
    return [];
  }
}

function savePost(post: Post): void {
  let posts: Post[] = [];
  if (existsSync(POSTS_FILE)) {
    try {
      posts = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
    } catch {}
  }
  posts.unshift(post);
  writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

function loadMatches(): PeerMatch[] {
  if (!existsSync(MATCHES_FILE)) return [];
  try {
    return JSON.parse(readFileSync(MATCHES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMatches(matches: PeerMatch[]): void {
  writeFileSync(MATCHES_FILE, JSON.stringify(matches, null, 2));
}

// Format time
function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString();
}

// Main App Component
function App() {
  const { exit } = useApp();
  const config = loadConfig();
  
  // State
  const [status, setStatus] = useState('connecting');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [matches, setMatches] = useState<PeerMatch[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  const [inputMode, setInputMode] = useState<'none' | 'channelName' | 'channelDesc' | 'post'>('none');
  const [inputValue, setInputValue] = useState('');

  // Network refs
  const embeddingService = React.useRef<any>(null);
  const dht = React.useRef<any>(null);
  const localPeer = React.useRef<VirtualPeer | null>(null);
  const discoveryTimer = React.useRef<NodeJS.Timeout | null>(null);
  const pendingChannelName = React.useRef('');

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  }, []);

  // Initialize network
  useEffect(() => {
    async function init() {
      try {
        addLog('Initializing identity...');
        const storage = createStorage();
        const identityService = createIdentityService(storage);
        await identityService.initialize();
        const identity = identityService.getIdentity();
        addLog(`Identity: ${identity?.name || 'Anonymous'}`);

        addLog('Loading embedding model...');
        embeddingService.current = createEmbeddingService();
        await embeddingService.current.load();
        addLog('Model loaded');

        addLog('Connecting to DHT...');
        dht.current = createDHT();
        
        localPeer.current = await VirtualPeer.create(
          identity?.peerId || `tui-${Date.now()}`,
          identity?.bio || 'ISC User',
          embeddingService.current
        );
        
        await localPeer.current.announce(dht.current);
        addLog('Announced to DHT');

        setStatus('connected');
        setChannels(loadChannels());
        setMatches(loadMatches());

        // Auto-discovery
        if (config.settings.autoDiscover) {
          discoveryTimer.current = setInterval(async () => {
            if (localPeer.current && dht.current) {
              const newMatches = await localPeer.current.discover(dht.current, 0.4);
              const uniqueMatches = newMatches.filter(
                m => m.peer.id !== localPeer.current!.id &&
                !matches.some(existing => existing.peer.id === m.peer.id)
              );
              if (uniqueMatches.length > 0) {
                setMatches(prev => [...uniqueMatches, ...prev].slice(0, 50));
                saveMatches([...uniqueMatches, ...matches].slice(0, 50));
                addLog(`Found ${uniqueMatches.length} match(es)!`);
              }
            }
          }, config.settings.discoverInterval * 1000);
          addLog(`Auto-discovery: ${config.settings.discoverInterval}s`);
        }

        addLog('Ready! Press ? for help');
      } catch (err) {
        addLog(`Error: ${(err as Error).message}`);
        setStatus('error');
      }
    }
    init();

    return () => {
      if (discoveryTimer.current) clearInterval(discoveryTimer.current);
    };
  }, []);

  // Update posts when channel changes
  useEffect(() => {
    if (channels[selectedChannelIndex]) {
      setPosts(loadPosts(channels[selectedChannelIndex].id));
    }
  }, [selectedChannelIndex, channels]);

  // Keyboard shortcuts
  useInput((input, key) => {
    // Handle text input modes
    if (inputMode !== 'none') {
      if (key.escape) {
        setInputMode('none');
        setInputValue('');
        return;
      }
      
      if (key.return) {
        if (inputMode === 'channelName') {
          if (inputValue.trim()) {
            pendingChannelName.current = inputValue.trim();
            setInputMode('channelDesc');
            setInputValue('');
          }
        } else if (inputMode === 'channelDesc') {
          createChannel(pendingChannelName.current, inputValue.trim());
          setInputMode('none');
          setInputValue('');
        } else if (inputMode === 'post') {
          createPost(inputValue.trim());
          setInputMode('none');
          setInputValue('');
        }
        return;
      }
      
      return;
    }

    // Normal mode shortcuts
    if (input === 'q' || (key.ctrl && input === 'c')) {
      if (discoveryTimer.current) clearInterval(discoveryTimer.current);
      addLog('Goodbye!');
      setTimeout(() => exit(), 100);
      return;
    }

    if (input === 'n') {
      setInputMode('channelName');
      return;
    }

    if (input === 'p') {
      if (channels.length === 0) {
        addLog('Create channel first!');
        return;
      }
      setInputMode('post');
      return;
    }

    if (input === 'd') {
      addLog('Discovering...');
      return;
    }

    if (input === '?') {
      addLog('n=NewChannel p=Post d=Discover q=Quit up/down=Navigate Enter=Select');
      return;
    }

    if (key.upArrow && selectedChannelIndex > 0) {
      setSelectedChannelIndex(prev => prev - 1);
    }

    if (key.downArrow && selectedChannelIndex < channels.length - 1) {
      setSelectedChannelIndex(prev => prev + 1);
    }

    if (key.return && channels[selectedChannelIndex]) {
      setPosts(loadPosts(channels[selectedChannelIndex].id));
      addLog(`Selected #${channels[selectedChannelIndex].name}`);
    }
  });

  // Create channel
  const createChannel = async (name: string, description: string) => {
    if (!name || !description) {
      addLog('Name and description required');
      return;
    }

    try {
      let embedding: number[] | undefined;
      if (embeddingService.current?.isLoaded()) {
        embedding = await embeddingService.current.compute(description);
      }

      const newChannel: Channel = {
        id: `ch_${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        embedding,
        createdAt: Date.now(),
      };

      setChannels(prev => [...prev, newChannel]);
      saveChannels([...channels, newChannel]);
      setSelectedChannelIndex(channels.length);
      addLog(`Created #${name.trim()}`);

      // Announce to DHT
      if (embedding && localPeer.current && dht.current) {
        try {
          await dht.current.announce({
            id: localPeer.current.id,
            name: config.identity.name,
            description: config.identity.bio,
            vector: embedding,
            topics: [newChannel.id],
            lastSeen: Date.now(),
          }, 300000);
          addLog('Announced to DHT');
        } catch {
          addLog('DHT announce failed');
        }
      }
    } catch (err) {
      addLog(`Error: ${(err as Error).message}`);
    }
  };

  // Create post
  const createPost = (content: string) => {
    if (!content || !channels[selectedChannelIndex]) {
      addLog('Nothing to post');
      return;
    }

    const post: Post = {
      id: `post_${Date.now()}`,
      channelId: channels[selectedChannelIndex].id,
      channelName: channels[selectedChannelIndex].name,
      content: content.trim(),
      author: config.identity.name,
      createdAt: Date.now(),
    };

    savePost(post);
    setPosts(prev => [post, ...prev]);
    addLog(`Posted to #${channels[selectedChannelIndex].name}`);
  };

  // Render channel list item
  const renderChannel = (channel: Channel, index: number) => {
    const isSelected = index === selectedChannelIndex;
    const prefix = isSelected ? '▶ ' : '  ';
    const color = isSelected ? 'green' : 'white';
    return <Text key={channel.id} color={color}>{prefix}#{channel.name}</Text>;
  };

  return (
    <Box flexDirection="column">
      {/* Status */}
      {status === 'connecting' ? (
        <Box padding={1}>
          <Text>
            <Spinner type="dots" /> Connecting...
          </Text>
        </Box>
      ) : (
        <>
          {/* Main layout */}
          <Box>
            {/* Channel list */}
            <Box flexDirection="column" marginRight={1} width={25}>
              <Text bold color="blue">[CHANNELS]</Text>
              {channels.length === 0 ? (
                <Text color="yellow">  (n)ew channel</Text>
              ) : (
                channels.map((c, i) => renderChannel(c, i))
              )}
            </Box>

            {/* Matches */}
            <Box flexDirection="column" marginRight={1} width={25}>
              <Text bold color="green">[MATCHES]</Text>
              {matches.length === 0 ? (
                <Text color="gray">  (d)iscover</Text>
              ) : (
                matches.slice(0, 8).map(m => (
                  <Text key={m.peer.id} color="green">
                    ✓ {m.peer.name} ({Math.round(m.similarity * 100)}%)
                  </Text>
                ))
              )}
            </Box>

            {/* Posts */}
            <Box flexDirection="column" flexGrow={1}>
              <Text bold color="blue">
                [POSTS]
                {channels[selectedChannelIndex] && ` - #${channels[selectedChannelIndex].name}`}
              </Text>
              {posts.length === 0 ? (
                <Text color="yellow">  (p)ost message</Text>
              ) : (
                posts.slice(0, 10).map(post => (
                  <Box key={post.id} flexDirection="column">
                    <Text>
                      <Text color="cyan">[{formatTime(post.createdAt)}]</Text>
                      <Text> </Text>
                      <Text bold color="magenta">{post.author}</Text>
                      <Text>: </Text>
                      <Text>{post.content}</Text>
                    </Text>
                  </Box>
                ))
              )}
            </Box>
          </Box>

          {/* Log */}
          <Box marginTop={1} flexDirection="column">
            <Text bold color="gray">[LOG]</Text>
            {logs.slice(-3).map((log, i) => (
              <Text key={i} color="gray">{log}</Text>
            ))}
          </Box>

          {/* Status bar */}
          <Box marginTop={1} justifyContent="space-between" borderTop={true} borderColor="gray">
            <Text>
              Status: <Text color={status === 'connected' ? 'green' : 'yellow'}>{status}</Text>
            </Text>
            <Text>
              Channels: {channels.length} | Matches: {matches.length}
            </Text>
            <Text color="gray">
              ↑↓:Nav Enter:Sel n:New p:Post d:Disc q:Quit ?:Help
            </Text>
          </Box>

          {/* Input prompt */}
          {inputMode !== 'none' && (
            <Box marginTop={1} flexDirection="column">
              {inputMode === 'channelName' && (
                <Box>
                  <Text color="cyan">Channel name: </Text>
                  <TextInput
                    value={inputValue}
                    onChange={setInputValue}
                    focus={true}
                  />
                </Box>
              )}
              {inputMode === 'channelDesc' && (
                <Box>
                  <Text color="cyan">Description: </Text>
                  <TextInput
                    value={inputValue}
                    onChange={setInputValue}
                    focus={true}
                  />
                </Box>
              )}
              {inputMode === 'post' && (
                <Box>
                  <Text color="cyan">Message: </Text>
                  <TextInput
                    value={inputValue}
                    onChange={setInputValue}
                    focus={true}
                  />
                </Box>
              )}
              <Text color="gray">Press Enter to confirm, ESC to cancel</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// Render the app
const { waitUntilExit } = render(<App />);

// Handle clean exit
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

waitUntilExit().then(() => {
  process.exit(0);
});
