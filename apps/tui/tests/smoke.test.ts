/* eslint-disable */
#!/usr/bin/env tsx
/**
 * TUI Smoke Test
 *
 * Tests TUI filesystem logic and @isc/network internals without starting the
 * blessed screen or loading the ML model. Imports individual source files
 * directly to bypass browser.ts (which starts libp2p/WebRTC listeners).
 * Calls process.exit() at the end to guarantee termination.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Direct source imports — bypasses barrel index.ts and browser.ts (libp2p/WebRTC)
import { MemoryStorage, createStorage } from '../../../packages/adapters/src/index.ts';
import { IdentityService } from '../../../packages/network/src/identity.ts';
import { InMemoryDHT } from '../../../packages/network/src/dht.ts';
import { TransformerEmbeddingService } from '../../../packages/network/src/embedding.ts';

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

const assert = (desc: string, ok: boolean, detail?: string) => {
  if (ok) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ ${desc}${detail ? `: ${detail}` : ''}`); failed++; }
};
const section = (name: string) => console.log(`\n── ${name} ──`);

// ─── Temp dir ─────────────────────────────────────────────────────────────────

const TMP = join(tmpdir(), `isc-smoke-${Date.now()}`);
mkdirSync(TMP, { recursive: true });
const CONFIG_FILE = join(TMP, 'config.json');
const CHANNELS_FILE = join(TMP, 'channels.json');
const POSTS_FILE = join(TMP, 'posts.json');

// ─── TUI filesystem logic (inlined from src/index.ts, pure — no blessed) ─────

interface Config {
  identity: { name: string; bio: string };
  settings: { theme: 'dark' | 'light'; notifications: boolean; autoDiscover: boolean; discoverInterval: number };
}
const DEFAULTS: Config = {
  identity: { name: 'Anonymous', bio: 'ISC User' },
  settings: { theme: 'dark', notifications: true, autoDiscover: true, discoverInterval: 30 },
};

const loadConfig = (): Config => {
  if (!existsSync(CONFIG_FILE)) return DEFAULTS;
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return DEFAULTS; }
};
const saveConfig = (c: Config) => writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
const loadChannels = () => {
  if (!existsSync(CHANNELS_FILE)) return [];
  try { return JSON.parse(readFileSync(CHANNELS_FILE, 'utf-8')); } catch { return []; }
};
const saveChannels = (ch: any[]) => writeFileSync(CHANNELS_FILE, JSON.stringify(ch, null, 2));
const savePost = (p: any) => {
  let all: any[] = [];
  if (existsSync(POSTS_FILE)) { try { all = JSON.parse(readFileSync(POSTS_FILE, 'utf-8')); } catch {} }
  all.unshift(p);
  writeFileSync(POSTS_FILE, JSON.stringify(all, null, 2));
};
const loadPosts = (channelId?: string) => {
  if (!existsSync(POSTS_FILE)) return [];
  try {
    const all = JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
    return channelId ? all.filter((p: any) => p.channelId === channelId) : all;
  } catch { return []; }
};
const formatTime = (ts: number): string => {
  const d = Date.now() - ts, m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : new Date(ts).toLocaleDateString();
};

// ─── Tests ────────────────────────────────────────────────────────────────────

section('Config I/O');
assert('default when missing', loadConfig().identity.name === 'Anonymous');
saveConfig({ ...DEFAULTS, identity: { name: 'Alice', bio: 'P2P' } });
const cfg = loadConfig();
assert('name persisted', cfg.identity.name === 'Alice');
assert('settings preserved', cfg.settings.theme === 'dark');

section('Channel I/O');
assert('empty when no file', loadChannels().length === 0);
saveChannels([{ id: 'ch1', name: 'AI', createdAt: Date.now() }]);
const chs = loadChannels();
assert('channel saved', chs.length === 1 && chs[0].name === 'AI');

section('Post I/O');
assert('empty when no file', loadPosts().length === 0);
savePost({ id: 'p1', channelId: 'ch1', content: 'Hello', createdAt: Date.now() });
savePost({ id: 'p2', channelId: 'ch2', content: 'World', createdAt: Date.now() });
assert('all posts', loadPosts().length === 2);
assert('filtered by channel', loadPosts('ch1').length === 1);
assert('newest first', loadPosts()[0].id === 'p2');

section('formatTime');
assert('< 1min → "now"', formatTime(Date.now() - 30_000) === 'now');
assert('5min → "5m"', formatTime(Date.now() - 5 * 60_000) === '5m');
assert('3h → "3h"', formatTime(Date.now() - 3 * 60 * 60_000) === '3h');

section('MemoryStorage');
const mem = new MemoryStorage();
await mem.set('k', { v: 1 });
assert('set/get', (await mem.get<{v:number}>('k'))?.v === 1);
await mem.set('p:a', 1); await mem.set('p:b', 2); await mem.set('x', 3);
assert('list prefix', (await mem.list('p:')).length === 2);
await mem.delete('k');
assert('delete', await mem.get('k') === null);
await mem.clear();
assert('clear', (await mem.list('')).length === 0);

section('createStorage (Node → MemoryStorage)');
assert('has get fn', typeof createStorage().get === 'function');

section('IdentityService');
const ids = IdentityService(new MemoryStorage());
await ids.initialize();
await ids.create('Test User', 'Test bio');
const id = ids.getIdentity();
assert('identity created', id !== null);
assert('peerId is string', typeof id?.peerId === 'string' && id.peerId.length > 0);
await ids.initialize(); // idempotent
assert('stable across re-init', ids.getIdentity()?.peerId === id?.peerId);

section('InMemoryDHT');
const dht = new InMemoryDHT();
const peer = { id: 'p1', name: 'Alice', description: 'AI researcher', vector: [1, 0, 0], topics: ['ai'], lastSeen: Date.now() };
await dht.announce(peer, 60000);
const hits = await dht.discover([1, 0, 0], 0); // threshold 0 = return all
assert('entry discoverable', hits.length >= 1);
assert('correct peer id', hits[0].peer.id === 'p1');
assert('similarity is 1 for identical vectors', Math.abs(hits[0].similarity - 1) < 1e-9);

section('EmbeddingService (no model load)');
const emb = new TransformerEmbeddingService();
assert('not loaded before load()', !emb.isLoaded());
assert('not loading', !emb.isLoading());
assert('no error', emb.getError() === null);
assert('similarity([1,0],[1,0]) = 1', Math.abs(emb.similarity([1,0],[1,0]) - 1) < 1e-9);
assert('orthogonal vectors = 0', Math.abs(emb.similarity([1,0],[0,1])) < 1e-9);

// ─── Cleanup + exit ───────────────────────────────────────────────────────────

rmSync(TMP, { recursive: true, force: true });
console.log(`\n══════════════════════════════`);
console.log(`Smoke: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════\n`);
process.exit(failed > 0 ? 1 : 0);
