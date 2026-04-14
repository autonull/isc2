#!/usr/bin/env node
/**
 * ISC Terminal UI - Modern IRC-style Interface
 * 
 * Built with Ink (React for terminal)
 * Inspired by HexChat, irssi, WeeChat
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

// Network imports
import {
  getClientNetworkService,
  type ClientNetworkService,
  type ChannelData,
  type PostData,
  type PeerMatch,
} from '@isc/network';

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
  
  // Network Service
  const network = useRef<ClientNetworkService | null>(null);

  // State
  const [status, setStatus] = useState('connecting');
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [matches, setMatches] = useState<PeerMatch[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  const [inputMode, setInputMode] = useState<'none' | 'channelName' | 'channelDesc' | 'post' | 'bio' | 'name'>('none');
  const [inputValue, setInputValue] = useState('');

  const [identityName, setIdentityName] = useState('');

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  }, []);

  // Initialize network
  useEffect(() => {
    async function init() {
      try {
        addLog('Initializing ClientNetworkService...');
        network.current = getClientNetworkService();

        // Bind events
        network.current.on({
          onStatusChange: (s) => setStatus(s),
          onChannelCreated: (c) => {
            setChannels((prev) => {
              if (prev.find(existing => existing.id === c.id)) return prev;
              return [...prev, c];
            });
            addLog(`Channel created/received: #${c.name}`);
          },
          onPostCreated: (p) => {
            setPosts((prev) => {
              if (prev.find(existing => existing.id === p.id)) return prev;
              return [p, ...prev];
            });
          },
          onMatchesUpdated: (m) => {
            setMatches(m);
          },
          onPeerDiscovered: (m) => {
             addLog(`Discovered peer: ${m.peer.name || m.peer.id.slice(-6)}`);
          }
        });

        await network.current.initialize();

        const id = network.current.getIdentity();
        if (id) setIdentityName(id.name);

        setChannels(network.current.getChannels());
        setPosts(network.current.getPosts());
        setMatches(network.current.getMatches());
        setStatus('connected');

        addLog('Ready! Press ? for help');
      } catch (err) {
        addLog(`Error: ${(err as Error).message}`);
        setStatus('error');
      }
    }
    init();

    return () => {
      if (network.current) {
        network.current.destroy();
      }
    };
  }, []);

  // Update posts when channel changes
  useEffect(() => {
    if (channels[selectedChannelIndex]) {
      setPosts(network.current?.getPosts(channels[selectedChannelIndex].id) || []);
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
        const val = inputValue.trim();
        setInputValue('');

        if (inputMode === 'channelName') {
          if (val) {
            // Need a way to pass this state sequentially, or use a ref. We'll use a hacky global for now or just prompt description separately
            (globalThis as any)._pendingChannelName = val;
            setInputMode('channelDesc');
          } else {
             setInputMode('none');
          }
        } else if (inputMode === 'channelDesc') {
          const cname = (globalThis as any)._pendingChannelName;
          if (cname && val) {
            network.current?.createChannel(cname, val).catch(e => addLog(`Error: ${e.message}`));
          }
          setInputMode('none');
        } else if (inputMode === 'post') {
          if (val && channels[selectedChannelIndex]) {
            network.current?.createPost(channels[selectedChannelIndex].id, val).catch(e => addLog(`Error: ${e.message}`));
          }
          setInputMode('none');
        } else if (inputMode === 'name') {
           if (val) {
              network.current?.updateIdentity({ name: val }).then(() => {
                  setIdentityName(val);
                  addLog(`Identity name updated to ${val}`);
              }).catch(e => addLog(`Error: ${e.message}`));
           }
           setInputMode('none');
        } else if (inputMode === 'bio') {
            if (val) {
                network.current?.updateIdentity({ bio: val }).then(() => {
                    addLog(`Identity bio updated`);
                }).catch(e => addLog(`Error: ${e.message}`));
            }
            setInputMode('none');
        }
        return;
      }
      
      return;
    }

    // Normal mode shortcuts
    if (input === 'q' || (key.ctrl && input === 'c')) {
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
      network.current?.discoverPeers().catch(e => addLog(`Error: ${e.message}`));
      return;
    }

    if (input === 'i') {
       setInputMode('name');
       return;
    }

    if (input === 'b') {
       setInputMode('bio');
       return;
    }

    if (input === '?') {
      addLog('n:NewChannel p:Post d:Discover i:Name b:Bio q:Quit up/down:Navigate Enter:Select');
      return;
    }

    if (key.upArrow && selectedChannelIndex > 0) {
      setSelectedChannelIndex(prev => prev - 1);
    }

    if (key.downArrow && selectedChannelIndex < channels.length - 1) {
      setSelectedChannelIndex(prev => prev + 1);
    }

    if (key.return && channels[selectedChannelIndex]) {
       // Re-fetch posts for selected channel
       setPosts(network.current?.getPosts(channels[selectedChannelIndex].id) || []);
       addLog(`Selected #${channels[selectedChannelIndex].name}`);
    }
  });

  // Render channel list item
  const renderChannel = (channel: ChannelData, index: number) => {
    const isSelected = index === selectedChannelIndex;
    const prefix = isSelected ? '▶ ' : '  ';
    const color = isSelected ? 'green' : 'white';
    return <Text key={channel.id} color={color}>{prefix}#{channel.name}</Text>;
  };

  return (
    <Box flexDirection="column" height={process.stdout.rows || 24}>
      {/* Status */}
      {status === 'connecting' || status === 'loading' ? (
        <Box padding={1} flexDirection="column" alignItems="center" flexGrow={1} justifyContent="center">
          <Text color="cyan">
            <Spinner type="dots" /> {status === 'loading' ? 'Loading AI Models...' : 'Connecting to P2P Network...'}
          </Text>
          <Text color="gray">This may take a few moments on the first run.</Text>
        </Box>
      ) : (
        <>
          {/* Header */}
          <Box borderBottom={true} borderColor="cyan" paddingX={1} justifyContent="space-between">
             <Text bold color="cyan">ISC Terminal</Text>
             <Text color="magenta">@{identityName}</Text>
          </Box>

          {/* Main layout */}
          <Box flexGrow={1}>
            {/* Channel list */}
            <Box flexDirection="column" marginRight={1} width={25} borderRight={true} borderColor="gray">
              <Text bold color="blue">[CHANNELS]</Text>
              {channels.length === 0 ? (
                <Text color="yellow">  (n)ew channel</Text>
              ) : (
                channels.map((c, i) => renderChannel(c, i))
              )}
            </Box>

            {/* Posts */}
            <Box flexDirection="column" flexGrow={1} paddingX={1}>
              <Text bold color="blue">
                [POSTS]
                {channels[selectedChannelIndex] && ` - #${channels[selectedChannelIndex].name}`}
              </Text>
              {posts.length === 0 ? (
                <Text color="yellow">  (p)ost message</Text>
              ) : (
                posts.slice(0, Math.max(5, (process.stdout.rows || 24) - 15)).map(post => (
                  <Box key={post.id} flexDirection="row" marginBottom={0}>
                    <Text color="cyan" wrap="truncate">[{formatTime(post.createdAt)}] </Text>
                    <Text bold color="magenta" wrap="truncate">{post.author}</Text>
                    <Text wrap="truncate">: </Text>
                    <Text wrap="wrap">{post.content}</Text>
                  </Box>
                ))
              )}
            </Box>

            {/* Matches */}
            <Box flexDirection="column" marginLeft={1} width={25} borderLeft={true} borderColor="gray" paddingX={1}>
              <Text bold color="green">[MATCHES]</Text>
              {matches.length === 0 ? (
                <Text color="gray">  (d)iscover</Text>
              ) : (
                matches.slice(0, 8).map(m => (
                  <Text key={m.peer.id} color="green" wrap="truncate">
                    ✓ {m.peer.name || 'Anonymous'} ({Math.round(m.similarity * 100)}%)
                  </Text>
                ))
              )}
            </Box>
          </Box>

          {/* Log */}
          <Box height={4} flexDirection="column" borderTop={true} borderColor="gray">
            {logs.slice(-3).map((log, i) => (
              <Text key={i} color="gray" wrap="truncate">{log}</Text>
            ))}
          </Box>

          {/* Status bar */}
          <Box justifyContent="space-between" borderTop={true} borderColor="cyan" paddingX={1}>
            <Text>
              Status: <Text color={status === 'connected' ? 'green' : 'yellow'}>{status}</Text>
            </Text>
            <Text color="gray">
              ↑↓:Nav Enter:Sel n:New p:Post d:Disc i:Name b:Bio q:Quit ?:Help
            </Text>
          </Box>

          {/* Input prompt */}
          {inputMode !== 'none' && (
            <Box flexDirection="row" borderTop={true} borderColor="gray" paddingX={1}>
              {inputMode === 'channelName' && <Text color="cyan">Channel name: </Text>}
              {inputMode === 'channelDesc' && <Text color="cyan">Description: </Text>}
              {inputMode === 'post' && <Text color="cyan">Message: </Text>}
              {inputMode === 'name' && <Text color="cyan">Update Name: </Text>}
              {inputMode === 'bio' && <Text color="cyan">Update Bio: </Text>}

              <Box flexGrow={1}>
                  <TextInput
                    value={inputValue}
                    onChange={setInputValue}
                    focus={true}
                  />
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// Render the app
const { waitUntilExit } = render(<App />, { exitOnCtrlC: true });

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
