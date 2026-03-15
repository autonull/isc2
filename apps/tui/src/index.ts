#!/usr/bin/env node

/**
 * ISC Terminal UI v2 - IRC-style interface with Network Integration
 * 
 * Uses @isc/network for real peer discovery and semantic matching.
 * Like irssi/weechat but for ISC.
 */

import blessed from 'blessed';
import { join, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  createEmbeddingService,
  createDHT,
  VirtualPeer,
  createIdentityService,
  createStorage,
  type PeerMatch,
} from '@isc/network';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(process.cwd(), 'isc-data');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const CHANNELS_FILE = join(DATA_DIR, 'channels.json');
const POSTS_FILE = join(DATA_DIR, 'posts.json');
const MATCHES_FILE = join(DATA_DIR, 'matches.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Configuration
interface Config {
  identity: {
    name: string;
    bio: string;
  };
  settings: {
    theme: 'dark' | 'light';
    notifications: boolean;
    autoDiscover: boolean;
    discoverInterval: number;
  };
}

function loadConfig(): Config {
  const defaults: Config = {
    identity: { name: 'Anonymous', bio: 'ISC User' },
    settings: {
      theme: 'dark',
      notifications: true,
      autoDiscover: true,
      discoverInterval: 30,
    },
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

// Load channels
function loadChannels() {
  if (!existsSync(CHANNELS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CHANNELS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveChannels(channels: any[]) {
  writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

// Load posts
function loadPosts(channelId?: string) {
  if (!existsSync(POSTS_FILE)) return [];
  try {
    const all = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
    return channelId ? all.filter((p: any) => p.channelId === channelId) : all;
  } catch {
    return [];
  }
}

function savePost(post: any) {
  let posts = [];
  if (existsSync(POSTS_FILE)) {
    try {
      posts = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
    } catch {}
  }
  posts.unshift(post);
  writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Load matches
function loadMatches(): PeerMatch[] {
  if (!existsSync(MATCHES_FILE)) return [];
  try {
    return JSON.parse(readFileSync(MATCHES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMatches(matches: PeerMatch[]) {
  writeFileSync(MATCHES_FILE, JSON.stringify(matches, null, 2));
}

// Network state
const config = loadConfig();
const storage = createStorage();
const identityService = createIdentityService(storage);
const embeddingService = createEmbeddingService();
const dht = createDHT();
let localPeer: VirtualPeer | null = null;
let discoveryInterval: NodeJS.Timeout | null = null;

// Create screens
const screen = blessed.screen({
  smartCSR: true,
  title: `ISC - ${config.identity.name}`,
  fullUnicode: true,
});

// Main layout
const layout = blessed.layout({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  parent: screen,
});

// Channel list (left sidebar)
const channelList = blessed.list({
  label: ' Channels ',
  tags: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'blue' },
    label: { fg: 'blue', bold: true },
    item: { fg: 'white' },
    selected: { bg: 'blue', fg: 'white' },
  },
  keys: true,
  vi: true,
  mouse: true,
  left: 0,
  top: 0,
  width: '25%',
  height: '70%',
  parent: layout,
});

// Matches panel (below channels)
const matchesBox = blessed.box({
  label: ' Matches ',
  tags: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'green' },
    label: { fg: 'green', bold: true },
  },
  left: 0,
  top: '70%',
  width: '25%',
  height: '30%',
  parent: layout,
  scrollable: true,
});

// Posts view (main area)
const postsBox = blessed.box({
  label: ' Posts ',
  tags: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'blue' },
    label: { fg: 'blue', bold: true },
  },
  left: '25%',
  top: 0,
  width: '75%',
  height: '80%',
  parent: layout,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  mouse: true,
});

// Input box (bottom)
const inputBox = blessed.textbox({
  label: ' Message ',
  tags: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'green' },
    label: { fg: 'green', bold: true },
    focused: { border: { fg: 'green' } },
  },
  left: '25%',
  top: '80%',
  width: '75%',
  height: '20%',
  parent: layout,
  keys: true,
  inputOnFocus: true,
});

// Status bar
const statusBar = blessed.box({
  content: '',
  tags: true,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  style: { bg: 'blue', fg: 'white' },
  parent: screen,
});

// State
let channels = loadChannels();
let selectedChannel: any = null;
let selectedChannelIndex = 0;
let matches: PeerMatch[] = loadMatches();
let networkStatus = 'connecting';

// Update status bar
function updateStatusBar() {
  const matchCount = matches.length;
  const channelCount = channels.length;
  statusBar.setContent(
    `{bold}ISC{/bold} | ` +
    `{cyan}${config.identity.name}{/cyan} | ` +
    `Status: {${networkStatus === 'connected' ? 'green' : 'yellow'}}${networkStatus}{/${networkStatus === 'connected' ? 'green' : 'yellow'}} | ` +
    `Channels: ${channelCount} | ` +
    `Matches: ${matchCount} | ` +
    `{yellow}↑↓{/yellow} Nav | {green}Enter{/green} Select | {red}q{/red} Quit | ` +
    `{cyan}n{/cyan} Channel | {cyan}p{/cyan} Post | {cyan}d{/cyan} Discover | {cyan}?{/cyan} Help`
  );
  screen.render();
}

// Update channel list
function updateChannelList() {
  channels = loadChannels();
  const items = channels.map((c: any, i: number) => {
    const isSelected = i === selectedChannelIndex;
    const prefix = isSelected ? '{bold}{green}▶{/green}{/bold} ' : '  ';
    return `${prefix}#${c.name}`;
  });

  if (channels.length === 0) {
    items.push('{yellow}No channels - press n to create{/yellow}');
  }

  channelList.setItems(items);
  channelList.select(selectedChannelIndex);
  screen.render();
}

// Update matches display
function updateMatchesDisplay() {
  if (matches.length === 0) {
    matchesBox.setContent('{dim}No matches yet\nPress d to discover{/dim}');
  } else {
    const content = matches.slice(0, 10).map((m: PeerMatch) => {
      const similarity = (m.similarity * 100).toFixed(0);
      return `{green}✓ ${m.peer.name} ({similarity}%){/green}\n{dim}${m.peer.description.slice(0, 30)}...{/dim}`;
    }).join('\n\n');
    matchesBox.setContent(content);
  }
  screen.render();
}

// Update posts view
function updatePostsView() {
  if (!selectedChannel) {
    postsBox.setContent('{yellow}Select a channel to view posts{/yellow}');
  } else {
    const posts = loadPosts(selectedChannel.id);
    if (posts.length === 0) {
      postsBox.setContent(`{yellow}No posts in #${selectedChannel.name} - press p to post{/yellow}`);
    } else {
      const content = posts.map((p: any) => {
        const time = formatTime(p.createdAt);
        const author = p.author || '@anon';
        return `{cyan}[${time}]{/cyan} {bold}${author}{/bold}: ${p.content}`;
      }).join('\n\n');
      postsBox.setContent(content);
    }
  }
  postsBox.setLabel(` Posts ${selectedChannel ? `- #${selectedChannel.name}` : ''} `);
  screen.render();
}

// Format timestamp
function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString();
}

// Initialize network
async function initializeNetwork() {
  try {
    networkStatus = 'loading';
    updateStatusBar();

    // Create/load identity first
    console.log('[TUI] Initializing identity...');
    await identityService.initialize();
    const identity = identityService.getIdentity();
    console.log(`[TUI] Identity: ${identity?.name} (${identity?.peerId})`);

    // Update screen title with identity name
    screen.title = `ISC - ${identity?.name || 'Anonymous'}`;
    screen.render();

    console.log('[TUI] Loading embedding model...');
    await embeddingService.load();
    console.log('[TUI] Model loaded');

    // Create local peer
    localPeer = await VirtualPeer.create(
      identity?.peerId || `tui-${Date.now()}`,
      identity?.bio || 'ISC User',
      embeddingService
    );

    // Announce to DHT
    await localPeer.announce(dht);
    console.log('[TUI] Announced to DHT');

    networkStatus = 'connected';
    updateStatusBar();

    // Start auto-discovery
    if (config.settings.autoDiscover) {
      startAutoDiscovery();
    }
  } catch (err) {
    console.error('[TUI] Network initialization failed:', err);
    networkStatus = 'error';
    updateStatusBar();
  }
}

// Discover peers
async function discoverPeers() {
  if (!localPeer) {
    addLogEntry('{red}Network not initialized{/red}');
    return;
  }

  addLogEntry('{cyan}Discovering peers...{/cyan}');
  const newMatches = await localPeer.discover(dht, 0.4);

  // Filter out self and duplicates
  const uniqueMatches = newMatches.filter(
    m => m.peer.id !== localPeer!.id &&
    !matches.some(existing => existing.peer.id === m.peer.id)
  );

  if (uniqueMatches.length > 0) {
    matches = [...uniqueMatches, ...matches].slice(0, 50);
    saveMatches(matches);
    updateMatchesDisplay();
    addLogEntry(`{green}Found ${uniqueMatches.length} new match(es)!{/green}`);

    if (config.settings.notifications) {
      addLogEntry(`{bold}New matches: ${uniqueMatches.map(m => m.peer.name).join(', ')}{/bold}`);
    }
  } else {
    addLogEntry('{dim}No new matches found{/dim}');
  }
}

// Start auto-discovery
function startAutoDiscovery() {
  if (discoveryInterval) clearInterval(discoveryInterval);

  const intervalSeconds = config.settings.discoverInterval;
  addLogEntry(`{dim}Auto-discovery every ${intervalSeconds}s{/dim}`);

  discoveryInterval = setInterval(() => {
    discoverPeers();
  }, intervalSeconds * 1000);
}

// Add log entry (for debug/status)
function addLogEntry(message: string) {
  const current = matchesBox.getContent();
  const lines = current.split('\n');
  lines.unshift(message);
  while (lines.length > 20) lines.pop();
  matchesBox.setContent(lines.join('\n'));
  screen.render();
}

// Create channel dialog
function createChannelDialog() {
  const nameBox = blessed.textbox({
    top: '40%',
    left: '30%',
    width: '40%',
    label: 'Channel Name:',
    border: 'line',
    style: { border: { fg: 'blue' } },
    parent: screen,
  });

  nameBox.focus();
  screen.render();

  nameBox.on('submit', (name: string) => {
    nameBox.destroy();

    if (!name.trim()) {
      screen.render();
      return;
    }

    const descBox = blessed.textbox({
      top: '50%',
      left: '30%',
      width: '40%',
      label: 'Description:',
      border: 'line',
      style: { border: { fg: 'blue' } },
      parent: screen,
    });

    descBox.focus();
    screen.render();

    descBox.on('submit', async (desc: string) => {
      descBox.destroy();

      // Compute embedding for semantic matching
      let embedding: number[] | undefined;
      try {
        embedding = await embeddingService.compute(desc || 'No description');
      } catch (err) {
        console.error('[TUI] Failed to compute embedding:', err);
      }

      const newChannel = {
        id: `channel_${Date.now()}`,
        name: name.trim(),
        description: desc.trim() || 'No description',
        embedding,
        createdAt: Date.now(),
        members: [localPeer?.id || 'unknown'],
      };

      // Announce to DHT if we have embedding
      if (embedding && localPeer) {
        try {
          await dht.announce({
            peerID: localPeer.id,
            channelID: newChannel.id,
            model: 'allminilm',
            vec: embedding,
            ttl: 300000,
            updatedAt: Date.now(),
            signature: new Uint8Array(64),
          }, 300000);
          console.log(`[TUI] Announced channel #${name.trim()} to DHT`);
        } catch (err) {
          console.error('[TUI] DHT announce failed:', err);
        }
      }

      channels.push(newChannel);
      saveChannels(channels);
      selectedChannelIndex = channels.length - 1;
      selectedChannel = newChannel;
      updateChannelList();
      updatePostsView();
      addLogEntry(`{green}Created channel #${name.trim()}{/green}`);
    });
  });
}

// Post dialog
function createPostDialog() {
  if (!selectedChannel) {
    addLogEntry('{yellow}Select a channel first{/yellow}');
    return;
  }

  inputBox.focus();
  screen.render();
}

// Submit post
async function submitPost(content: string) {
  if (!selectedChannel || !content.trim()) {
    inputBox.clear();
    screen.render();
    return;
  }

  const post = {
    id: `post_${Date.now()}`,
    channelId: selectedChannel.id,
    channelName: selectedChannel.name,
    content: content.trim(),
    author: config.identity.name,
    createdAt: Date.now(),
  };

  savePost(post);
  inputBox.clear();
  inputBox.blur();
  updatePostsView();
  channelList.focus();
  screen.render();
  addLogEntry(`{green}Posted to #${selectedChannel.name}{/green}`);
}

// Show help
function showHelp() {
  const helpText = [
    '{bold}═══════════════════════════════════════════════════════════{/bold}',
    '{bold}                    ISC TUI Help{/bold}',
    '{bold}═══════════════════════════════════════════════════════════{/bold}',
    '',
    '{bold}Navigation:{/bold}',
    '  ↑/k  Move up',
    '  ↓/j  Move down',
    '  Enter  Select channel',
    '',
    '{bold}Actions:{/bold}',
    '  n  New channel',
    '  p  New post (select channel first)',
    '  d  Discover peers',
    '  /  Search (coming soon)',
    '',
    '{bold}System:{/bold}',
    '  ?  This help',
    '  q  Quit',
    '',
    '{bold}Status:{/bold}',
    `  Network: ${networkStatus}`,
    `  Identity: ${config.identity.name}`,
    `  Channels: ${channels.length}`,
    `  Matches: ${matches.length}`,
    '',
    '{bold}═══════════════════════════════════════════════════════════{/bold}',
    '  Press any key to close',
  ].join('\n');

  const helpBox = blessed.box({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '70%',
    content: helpText,
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan' },
      label: { fg: 'cyan', bold: true },
    },
    parent: screen,
  });

  screen.render();

  helpBox.once('key', () => {
    helpBox.destroy();
    screen.render();
  });
}

// Key bindings
channelList.on('select', (item: any, index: number) => {
  if (index < channels.length) {
    selectedChannelIndex = index;
    selectedChannel = channels[index];
    updatePostsView();
  }
});

channelList.key(['enter', 'space'], () => {
  const index = channelList.selected;
  if (index < channels.length) {
    selectedChannelIndex = index;
    selectedChannel = channels[index];
    updatePostsView();
  }
});

screen.key(['n', 'N'], () => {
  createChannelDialog();
});

screen.key(['p', 'P'], () => {
  createPostDialog();
});

screen.key(['d', 'D'], () => {
  discoverPeers();
});

screen.key(['?', '/'], () => {
  showHelp();
});

inputBox.key(['enter'], () => {
  submitPost(inputBox.getValue());
});

inputBox.key(['escape'], () => {
  inputBox.clear();
  inputBox.blur();
  channelList.focus();
  screen.render();
});

screen.key(['q', 'C-c'], () => {
  if (discoveryInterval) clearInterval(discoveryInterval);
  process.exit(0);
});

// Mouse support
screen.key(['up', 'k'], () => {
  if (channelList.selected > 0) {
    channelList.select(channelList.selected - 1);
    screen.render();
  }
});

screen.key(['down', 'j'], () => {
  if (channelList.selected < channels.length - 1) {
    channelList.select(channelList.selected + 1);
    screen.render();
  }
});

// Initialize
async function main() {
  console.clear();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Welcome to ISC Terminal UI');
  console.log('═══════════════════════════════════════════════════════════\n');

  updateChannelList();
  updateMatchesDisplay();
  updatePostsView();
  updateStatusBar();
  channelList.focus();
  screen.render();

  // Initialize network in background
  console.log('Initializing network...\n');
  await initializeNetwork();

  // Show identity info
  const identity = identityService.getIdentity();
  if (identity) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Peer ID: ${identity.peerId}`);
    console.log(`  Name: ${identity.name}`);
    console.log(`  Bio: ${identity.bio}`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  console.log('TUI ready. Press ? for help, n to create your first channel.\n');

  // Handle resize
  screen.on('resize', () => {
    screen.render();
  });
}

main().catch(console.error);
