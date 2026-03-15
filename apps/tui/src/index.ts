#!/usr/bin/env node

/**
 * ISC Terminal UI - IRC-style terminal interface
 * 
 * Like irssi/weechat but for ISC
 */

import blessed from 'blessed';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// Data directories
const DATA_DIR = join(process.cwd(), 'isc-data');
const CHANNELS_FILE = join(DATA_DIR, 'channels.json');
const POSTS_FILE = join(DATA_DIR, 'posts.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  console.log('ISC not initialized. Run: pnpm --filter @isc/apps/cli dev -- init');
  process.exit(1);
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

// Save channels
function saveChannels(channels) {
  writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

// Load posts
function loadPosts(channelId) {
  if (!existsSync(POSTS_FILE)) return [];
  try {
    const all = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
    return channelId ? all.filter(p => p.channelId === channelId) : all;
  } catch {
    return [];
  }
}

// Save post
function savePost(post) {
  let posts = [];
  if (existsSync(POSTS_FILE)) {
    try {
      posts = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
    } catch {}
  }
  posts.unshift(post);
  writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Create screens
const screen = blessed.screen({
  smartCSR: true,
  title: 'ISC - Internet Semantic Chat',
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
  border: {
    type: 'line',
  },
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
  width: '30%',
  height: '100%',
  parent: layout,
});

// Posts view (main area)
const postsBox = blessed.box({
  label: ' Posts ',
  tags: true,
  border: {
    type: 'line',
  },
  style: {
    border: { fg: 'blue' },
    label: { fg: 'blue', bold: true },
  },
  left: '30%',
  top: 0,
  width: '70%',
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
  border: {
    type: 'line',
  },
  style: {
    border: { fg: 'green' },
    label: { fg: 'green', bold: true },
    focused: { border: { fg: 'green' } },
  },
  left: '30%',
  top: '80%',
  width: '70%',
  height: '20%',
  parent: layout,
  keys: true,
  inputOnFocus: true,
});

// Status bar
const statusBar = blessed.box({
  content: '{bold}ISC{/bold} | {cyan}Channels: {count}{/cyan} | {yellow}↑↓{/yellow} Navigate | {green}Enter{/green} Select | {red}q{/red} Quit | {cyan}n{/cyan} New Channel | {cyan}p{/cyan} New Post',
  tags: true,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  style: {
    bg: 'blue',
    fg: 'white',
  },
  parent: screen,
});

// State
let channels = loadChannels();
let selectedChannel = null;
let selectedChannelIndex = 0;

// Update channel list
function updateChannelList() {
  channels = loadChannels();
  const items = channels.map((c, i) => {
    const isSelected = i === selectedChannelIndex;
    const prefix = isSelected ? '{bold}{green}▶{/green}{/bold} ' : '  ';
    return `${prefix}#${c.name}`;
  });
  
  if (channels.length === 0) {
    items.push('{yellow}No channels - press n to create{/yellow}');
  }
  
  channelList.setItems(items);
  channelList.select(selectedChannelIndex);
  
  // Update status bar
  statusBar.setContent(`{bold}ISC{/bold} | {cyan}Channels: ${channels.length}{/cyan} | {yellow}↑↓{/yellow} Navigate | {green}Enter{/green} Select | {red}q{/red} Quit | {cyan}n{/cyan} New Channel | {cyan}p{/cyan} New Post`);
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
      const content = posts.map(p => {
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
function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString();
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
  
  nameBox.on('submit', (name) => {
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
    
    descBox.on('submit', (desc) => {
      descBox.destroy();
      
      const newChannel = {
        id: `channel_${Date.now()}`,
        name: name.trim(),
        description: desc.trim() || 'No description',
        createdAt: Date.now(),
        members: [],
      };
      
      channels.push(newChannel);
      saveChannels(channels);
      selectedChannelIndex = channels.length - 1;
      selectedChannel = newChannel;
      updateChannelList();
      updatePostsView();
    });
  });
}

// Post dialog
function createPostDialog() {
  if (!selectedChannel) {
    return;
  }
  
  inputBox.focus();
  screen.render();
}

// Submit post
function submitPost(content) {
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
    author: '@you',
    createdAt: Date.now(),
  };
  
  savePost(post);
  inputBox.clear();
  inputBox.blur();
  updatePostsView();
  channelList.focus();
  screen.render();
}

// Key bindings
channelList.on('select', (item, index) => {
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
  if (selectedChannel) {
    createPostDialog();
  }
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
updateChannelList();
updatePostsView();
channelList.focus();
screen.render();

// Handle resize
screen.on('resize', () => {
  screen.render();
});
