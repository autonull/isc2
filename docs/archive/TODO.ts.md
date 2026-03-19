# TypeScript Implementation TODO - COMPREHENSIVE

**Goal:** Complete essential messaging with full UI/UX flow support

**Current Status:** ~80% complete  
**Estimated Effort:** 19 hours  
**Test Coverage:** 10 Conclusive E2E tests

---

## Complete UI/UX Flow Map

### Flow 1: First-Time Onboarding ✅ COMPLETE
```
App.tsx (line 93) → checks localStorage 'isc-onboarding-completed'
  ↓
Onboarding.tsx → 3-step wizard
  ↓
WelcomeStep → CreateChannelStep → DiscoverStep
  ↓
Main app (IRCSidebar + NowScreen)
```
**Files:** `App.tsx:78-93`, `Onboarding.tsx`, `WelcomeStep.tsx`, `CreateChannelStep.tsx`, `DiscoverStep.tsx`  
**Status:** ✅ Complete

---

### Flow 2: Identity Creation ✅ COMPLETE
```
Onboarding Step 1 OR Settings Screen
  ↓
identity/index.ts → initializeIdentity()
  ↓
IndexedDB store 'isc-identity'
  ↓
Ed25519 keypair generated
  ↓
Public key fingerprint displayed
```
**Files:** `identity/index.ts:79-125`, `Settings.tsx:50-70`  
**Status:** ✅ Complete

---

### Flow 3: Channel Creation ✅ COMPLETE
```
IRCSidebar.tsx:65 → "+ New Channel" button (via Compose tab)
  ↓
ComposeScreen.tsx → name/description inputs
  ↓
channelService.ts → createChannel()
  ↓
IndexedDB 'channels' store
  ↓
Sidebar updates with new channel
```
**Files:** `IRCSidebar.tsx:65-72`, `ComposeScreen.tsx`, `services/channelService.ts:45-80`  
**Status:** ✅ Complete

---

### Flow 4: Post Message ✅ COMPLETE
```
NowScreen.tsx:68 → ComposePost component
  ↓
ComposePost.tsx:64 → textarea input
  ↓
ComposePost.tsx:73 → handleSubmit()
  ↓
postService.createPost()
  ↓
Toast notification + feed update
```
**Files:** `NowScreen.tsx:68`, `ComposePost.tsx:64-100`, `services/postService.ts:90-130`  
**UI Elements:** textarea (data-testid="compose-post-textarea"), submit button (data-testid="submit-post")  
**Status:** ✅ Complete

---

### Flow 5: Attach File to Post ❌ MISSING - IN PLAN
```
ComposePost.tsx → NO attachment button currently
  ↓
[PLAN] Add file input + attach button
  ↓
fileTransferService.stageFile() → compute SHA-256 hash
  ↓
Append [FILE:hash] to content
  ↓
Post with file reference
```
**Files to Create/Modify:** `ComposePost.tsx:ADD`, `services/fileTransferService.ts:NEW`  
**Status:** ❌ Missing - Phase 1.3

---

### Flow 6: Download File from Post ❌ MISSING - IN PLAN
```
Post.tsx → NO file link rendering currently
  ↓
[PLAN] Parse [FILE:hash] from content
  ↓
Render download link
  ↓
Click → fileTransferService.downloadFile()
  ↓
Browser download starts
```
**Files to Modify:** `Post.tsx:MODIFY`, `protocol/file.ts:NEW`  
**Status:** ❌ Missing - Phase 1.3

---

### Flow 7: Direct Messaging ✅ COMPLETE
```
IRCSidebar → Chats tab (line 18)
  ↓
ChatsScreen.tsx → ConversationList
  ↓
ConversationList.tsx:27 → peer selection
  ↓
ChatPanel.tsx → message input + send
  ↓
chatService.send() → IndexedDB + WebRTC
```
**Files:** `ChatsScreen.tsx`, `ConversationList.tsx`, `ChatPanel.tsx`, `services/chatService.ts:60-90`  
**UI Elements:** conversation-list (data-testid), message-input (data-testid), send-button (data-testid)  
**Status:** ✅ Complete

---

### Flow 8: Peer Discovery ✅ COMPLETE
```
IRCSidebar → Discover tab (line 17)
  ↓
DiscoverScreen.tsx:100 → "Discover" button
  ↓
networkService.discoverPeers()
  ↓
DHT query with LSH hashes
  ↓
PeerCard.tsx → similarity % display
```
**Files:** `DiscoverScreen.tsx:100-120`, `services/networkService.ts:70-90`  
**UI Elements:** discover button, peer cards with match %  
**Status:** ✅ Complete

---

### Flow 9: Historical Sync ❌ PARTIAL - IN PLAN
```
NowScreen.tsx:42 → useEffect loads posts
  ↓
[PLAN] Add sync trigger when channel selected
  ↓
postSyncService.requestHistoricalPosts()
  ↓
[PLAN] Show "🔄 Synchronizing..." indicator
  ↓
Posts appear in feed
```
**Files to Modify:** `hooks/useFeed.ts:MODIFY`, `NowScreen.tsx:ADD`, `services/postSyncService.ts:NEW`  
**Status:** ⚠️ Partial - Phase 2.3

---

### Flow 10: Offline Indicator ✅ COMPLETE
```
App.tsx:25 → useConnectionStatus()
  ↓
IRCSidebar.tsx:35 → connectionStatus prop
  ↓
Connection indicator dot (green/yellow/red)
  ↓
ChatsScreen.tsx:177 → offline banner
```
**Files:** `App.tsx:25`, `IRCSidebar.tsx:35`, `hooks/index.ts:useConnectionStatus`, `ChatsScreen.tsx:177`  
**UI Elements:** connection-indicator (data-testid), offline-indicator (data-testid)  
**Status:** ✅ Complete

---

### Flow 11: Settings/Profile ✅ COMPLETE
```
IRCSidebar → Settings tab (line 19)
  ↓
SettingsScreen.tsx:50 → load identity
  ↓
SettingsScreen.tsx:280 → export/import buttons
  ↓
SettingsScreen.tsx:200 → name/bio inputs
  ↓
networkService.updateIdentity()
```
**Files:** `SettingsScreen.tsx`, `services/identityService.ts`  
**UI Elements:** name input, bio textarea, export button, import button  
**Status:** ✅ Complete

---

## Essential Gaps (This TODO)

| Gap | Priority | Effort | Files | User Impact |
|-----|----------|--------|-------|-------------|
| **File Transfer** | 🔴 Critical | 7h | `protocol/file.ts`, `services/fileTransferService.ts` | Cannot share files |
| **Historical Sync UI** | 🔴 Critical | 7h | `protocol/post.ts`, `services/postSyncService.ts`, `NowScreen.tsx` | New users see empty feeds |
| **UI Integration** | 🔴 Critical | 3h | `ComposePost.tsx`, `Post.tsx` | No attachment UX |
| **Tests** | 🔴 Critical | 4h | Unit + E2E (already created) | Verification |

**Total: 19 hours**

---

## Deferred (Future Social Features)

- ⏸️ Feed scoring system (exists in feedService.ts, not essential)
- ⏸️ Typing indicators (UX enhancement - TypingIndicatorService exists)
- ⏸️ Offline queue integration (infrastructure exists in offline/, not wired)
- ⏸️ Network screen (nice-to-have)
- ⏸️ Video calls (advanced feature - VideoCalls.tsx exists)
- ⏸️ Reputation system (Phase 2 - ReputationService exists)
- ⏸️ Moderation courts (Phase 2 - courts.ts exists)

---

## Phase 1: File Transfer Protocol (7 hours)

### 1.1 File Protocol Handler (3h)

**File:** `apps/browser/src/protocol/file.ts`

**⚠️ CONCERNS:**
- Browser security limits file system access
- Must use Blob for downloads
- Large files may cause memory issues (>100MB)
- Need to handle connection drops during transfer

**Implementation:**
```typescript
/**
 * File Transfer Protocol - /isc/file/1.0
 * Matches Java's FileProtocol with length-prefixed frames
 * 
 * @see java/src/main/java/network/isc/protocol/FileProtocol.java
 */

import type { Libp2p } from 'libp2p';
import type { Stream } from '@libp2p/interface';
import { toString, fromString } from 'uint8arrays';

const PROTOCOL_FILE = '/isc/file/1.0';
const CHUNK_SIZE = 8192; // 8KB chunks - balance between overhead and throughput
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit for browser memory

export class FileProtocol {
  private node: Libp2p;

  constructor(node: Libp2p) {
    this.node = node;
  }

  /**
   * Request file from peer
   * @param peerId - Peer to request from
   * @param hash - SHA-256 hash of file
   * @returns Blob containing file data
   */
  async requestFile(peerId: string, hash: string): Promise<Blob> {
    const stream = await this.node.dialProtocol(peerId as any, PROTOCOL_FILE);
    await stream.sink([fromString(`REQ:${hash}`, 'utf-8')]);
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream.source as AsyncIterable<Uint8Array>) {
      const text = toString(chunk, 'utf-8');
      if (text.startsWith('EOF:')) break; // End of transfer marker
      chunks.push(chunk);
    }
    
    await stream.close();
    return new Blob(chunks);
  }

  /**
   * Send file to peer
   * @param peerId - Peer to send to
   * @param file - File to send
   */
  async sendFile(peerId: string, file: File): Promise<void> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.size} bytes (max: ${MAX_FILE_SIZE})`);
    }
    
    const stream = await this.node.dialProtocol(peerId as any, PROTOCOL_FILE);
    const chunks = await this.readFileChunks(file);
    
    for (const chunk of chunks) {
      await stream.sink([chunk]);
      await new Promise(r => setTimeout(r, 1)); // Prevent overwhelming network
    }
    
    await stream.sink([fromString(`EOF:${file.name}`, 'utf-8')]);
    await stream.close();
  }

  private async readFileChunks(file: File): Promise<Uint8Array[]> {
    const chunks: Uint8Array[] = [];
    const data = new Uint8Array(await file.arrayBuffer());
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, Math.min(i + CHUNK_SIZE, data.length)));
    }
    return chunks;
  }

  /**
   * Compute SHA-256 hash of file
   */
  static async computeHash(file: File): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

**Acceptance Criteria:**
- [ ] Protocol handler created
- [ ] Can request file from peer
- [ ] Can send file to peer
- [ ] Chunks assemble correctly
- [ ] EOF detection works
- [ ] File size limit enforced

---

### 1.2 File Transfer Service (2h)

**File:** `apps/browser/src/services/fileTransferService.ts`

**⚠️ CONCERNS:**
- IndexedDB has storage limits (varies by browser)
- Need to clean up old staged files
- Memory usage for large files

**Implementation:**
```typescript
import { FileProtocol } from '../protocol/file.js';
import type { Libp2p } from 'libp2p';

interface StagedFile {
  hash: string;
  name: string;
  type: string;
  size: number;
  data: Uint8Array;
  timestamp: number;
}

export class FileTransferService {
  private protocol: FileProtocol;
  private stagedFiles = new Map<string, StagedFile>();
  private readonly MAX_STAGED_FILES = 50;

  constructor(node: Libp2p) {
    this.protocol = new FileProtocol(node);
  }

  /**
   * Stage file for sharing
   */
  async stageFile(file: File): Promise<string> {
    const hash = await FileProtocol.computeHash(file);
    const data = new Uint8Array(await file.arrayBuffer());
    
    // Cleanup if too many staged files
    if (this.stagedFiles.size >= this.MAX_STAGED_FILES) {
      const oldest = Array.from(this.stagedFiles.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.stagedFiles.delete(oldest[0]);
    }
    
    this.stagedFiles.set(hash, {
      hash,
      name: file.name,
      type: file.type,
      size: file.size,
      data,
      timestamp: Date.now(),
    });
    
    await this.saveToStorage(hash);
    return hash;
  }

  /**
   * Download file from network
   */
  async downloadFile(peerId: string, hash: string): Promise<Blob> {
    return this.protocol.requestFile(peerId, hash);
  }

  /**
   * Get staged file
   */
  getStagedFile(hash: string): StagedFile | null {
    return this.stagedFiles.get(hash) || null;
  }

  private async saveToStorage(hash: string): Promise<void> {
    const { dbPut } = await import('../db/helpers.js');
    const db = await import('../db/factory.js')
      .then(m => m.getDB('isc-files', 1, ['files']));
    await dbPut(db, 'files', this.stagedFiles.get(hash)!);
  }
}

let _instance: FileTransferService | null = null;
export function getFileTransferService(node: Libp2p): FileTransferService {
  if (!_instance) _instance = new FileTransferService(node);
  return _instance;
}
```

---

### 1.3 UI Integration (3h)

**Modify:** `apps/browser/src/components/ComposePost.tsx`

**⚠️ CONCERNS:**
- File input must be hidden but accessible
- Need to show file preview before posting
- Handle large file warnings

**Changes:**
```typescript
// Add imports
import { useState } from 'preact/hooks';
import { useDependencies } from '../di/container.js';

// Add state after existing state
const [attachedFile, setAttachedFile] = useState<File | null>(null);
const { networkService } = useDependencies();

// Add handler before handleSubmit
const handleAttach = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  
  // Warn if file is large
  if (file.size > 10 * 1024 * 1024) { // 10MB
    const confirm = window.confirm(
      `File is ${Math.round(file.size / 1024 / 1024)}MB. Large files may fail to transfer. Continue?`
    );
    if (!confirm) {
      input.value = '';
      return;
    }
  }
  
  const node = networkService?.getNode?.();
  if (node) {
    const { getFileTransferService } = await import('../services/fileTransferService');
    const service = getFileTransferService(node);
    const hash = await service.stageFile(file);
    setAttachedFile(file);
    setContent(prev => prev + ` [FILE:${hash}]`);
    toast.success(`Attached: ${file.name}`);
  }
  input.value = ''; // Reset input
};

// Add to render (after textarea, before footer)
<div style={{ marginBottom: '12px' }}>
  <input
    type="file"
    id="file-attach"
    style={{ display: 'none' }}
    onChange={handleAttach}
    data-testid="file-attach-input"
  />
  <label
    htmlFor="file-attach"
    style={{
      display: 'inline-block',
      padding: '6px 12px',
      background: '#e8f4fd',
      color: '#1da1f2',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '13px',
    }}
    data-testid="file-attach-button"
  >
    📎 Attach File
  </label>
  {attachedFile && (
    <div
      data-testid="file-preview"
      style={{
        marginTop: '8px',
        padding: '8px',
        background: '#f7f9fa',
        borderRadius: '6px',
        fontSize: '13px',
      }}
    >
      📎 {attachedFile.name} ({Math.round(attachedFile.size / 1024)} KB)
      <button
        onClick={() => {
          setAttachedFile(null);
          setContent(prev => prev.replace(/ \[FILE:[a-f0-9]+\]/, ''));
        }}
        style={{
          marginLeft: '8px',
          background: 'none',
          border: 'none',
          color: '#e0245e',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )}
</div>
```

**Modify:** `apps/browser/src/components/Post.tsx`

**⚠️ CONCERNS:**
- File links must be clearly visible
- Download should provide feedback
- Handle missing files gracefully

**Changes:**
```typescript
// Add handler before renderContent
const handleFileDownload = async (hash: string) => {
  try {
    const { getFileTransferService } = await import('../services/fileTransferService');
    const { useDependencies } = await import('../di/container');
    // Note: Need to get node from context or props
    toast.info('Downloading file...');
    // TODO: Implement download with proper node access
  } catch (err) {
    toast.error('Failed to download file');
  }
};

// Modify renderContent
const renderContent = (content: string) => {
  const fileMatch = content.match(/\[FILE:([a-f0-9]+)\]/);
  
  return (
    <p style={STYLES.content}>
      {content.replace(/\[FILE:[a-f0-9]+\]/, '')}
      {fileMatch && (
        <a
          href={`#file:${fileMatch[1]}`}
          onClick={(e) => {
            e.preventDefault();
            handleFileDownload(fileMatch[1]);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#1da1f2',
            textDecoration: 'none',
            padding: '4px 8px',
            background: '#e8f4fd',
            borderRadius: '4px',
            fontSize: '13px',
          }}
          data-testid="file-download-link"
        >
          📎 Download Attachment
        </a>
      )}
    </p>
  );
};
```

---

## Phase 2: Historical Post Sync (7 hours)

### 2.1 Post Protocol Handler (2h)

**File:** `apps/browser/src/protocol/post.ts`

**⚠️ CONCERNS:**
- Must match Java's SYNC_REQUEST pattern exactly
- Need to handle large channel histories (limit to 100 posts)
- Deduplication critical to prevent duplicates

**Implementation:**
```typescript
/**
 * Historical Post Sync Protocol - /isc/post/1.0
 * Matches Java's PostProtocol with SYNC_REQUEST pattern
 * 
 * @see java/src/main/java/network/isc/protocol/PostProtocol.java
 * @see java/src/main/java/network/isc/controllers/ChatController.java#155
 */

import type { Libp2p } from 'libp2p';
import type { Stream } from '@libp2p/interface';
import { toString, fromString } from 'uint8arrays';
import type { PostData } from '@isc/network';

const PROTOCOL_POST = '/isc/post/1.0';
const MAX_HISTORY_POSTS = 100; // Limit to prevent overwhelming

interface PostCallbacks {
  onHistoricalPost?: (post: PostData) => void;
  onSyncRequest?: (channelId: string) => Promise<PostData[]>;
}

export class PostProtocol {
  private node: Libp2p;
  private callbacks: PostCallbacks;

  constructor(node: Libp2p, callbacks: PostCallbacks) {
    this.node = node;
    this.callbacks = callbacks;
  }

  /**
   * Request historical posts for channel
   */
  async requestHistoricalPosts(peerId: string, channelId: string): Promise<void> {
    const stream = await this.node.dialProtocol(peerId as any, PROTOCOL_POST);
    await stream.sink([
      fromString(JSON.stringify({
        type: 'SYNC_REQUEST',
        channelId,
        timestamp: Date.now(),
      }), 'utf-8')
    ]);
    
    let count = 0;
    for await (const chunk of stream.source as AsyncIterable<Uint8Array>) {
      if (count >= MAX_HISTORY_POSTS) break;
      const post = JSON.parse(toString(chunk, 'utf-8'));
      if (this.callbacks.onHistoricalPost) {
        this.callbacks.onHistoricalPost(post);
        count++;
      }
    }
    await stream.close();
  }

  async handleStream(stream: Stream): Promise<void> {
    for await (const chunk of stream.source as AsyncIterable<Uint8Array>) {
      const data = JSON.parse(toString(chunk, 'utf-8'));
      if (data.type === 'SYNC_REQUEST') {
        await this.handleSyncRequest(stream, data.channelId);
      } else if (this.callbacks.onHistoricalPost) {
        this.callbacks.onHistoricalPost(data);
      }
    }
  }

  private async handleSyncRequest(stream: Stream, channelId: string): Promise<void> {
    if (!this.callbacks.onSyncRequest) { await stream.close(); return; }
    const posts = await this.callbacks.onSyncRequest(channelId);
    // Send limited number of posts
    for (const post of posts.slice(0, MAX_HISTORY_POSTS)) {
      await stream.sink([fromString(JSON.stringify(post), 'utf-8')]);
    }
    await stream.close();
  }
}
```

---

### 2.2 Post Sync Service (2h)

**File:** `apps/browser/src/services/postSyncService.ts`

**⚠️ CONCERNS:**
- Must deduplicate by post ID
- Need to handle concurrent sync requests
- Storage limits for posts

**Implementation:**
```typescript
import { PostProtocol } from '../protocol/post.js';
import type { Libp2p } from 'libp2p';
import type { PostData } from '@isc/network';

export class PostSyncService {
  private protocol: PostProtocol;
  private receivedPosts = new Map<string, PostData>();
  private syncInProgress = new Set<string>();

  constructor(node: Libp2p, postService: any) {
    this.protocol = new PostProtocol(node, {
      onHistoricalPost: (post) => this.handleHistoricalPost(post),
      onSyncRequest: (channelId) => this.getPostsForChannel(channelId, postService),
    });
  }

  async requestHistoricalPosts(peerId: string, channelId: string): Promise<void> {
    // Prevent concurrent syncs for same channel
    if (this.syncInProgress.has(channelId)) {
      console.log('Sync already in progress for channel:', channelId);
      return;
    }
    
    this.syncInProgress.add(channelId);
    try {
      await this.protocol.requestHistoricalPosts(peerId, channelId);
    } finally {
      this.syncInProgress.delete(channelId);
    }
  }

  private handleHistoricalPost(post: PostData): void {
    // Deduplicate by ID
    if (!this.receivedPosts.has(post.id)) {
      this.receivedPosts.set(post.id, post);
      this.savePost(post);
    }
  }

  private async getPostsForChannel(channelId: string, postService: any): Promise<PostData[]> {
    return postService.getPostsByChannel(channelId);
  }

  private async savePost(post: PostData): Promise<void> {
    const { dbPut } = await import('../db/helpers.js');
    const db = await import('../db/factory.js')
      .then(m => m.getDB('isc-posts', 1, ['posts']));
    await dbPut(db, 'posts', post);
  }
}

let _instance: PostSyncService | null = null;
export function getPostSyncService(node: Libp2p, postService: any): PostSyncService {
  if (!_instance) _instance = new PostSyncService(node, postService);
  return _instance;
}
```

---

### 2.3 Integration with Feed (3h)

**Modify:** `apps/browser/src/hooks/useFeed.ts`

**⚠️ CONCERNS:**
- Sync should not block UI
- Need loading indicator
- Handle sync failures gracefully

**Changes:**
```typescript
// Add sync state
const [syncing, setSyncing] = useState(false);
const [syncError, setSyncError] = useState<string | null>(null);

// Add useEffect for historical sync
useEffect(() => {
  if (type === 'channel' && channelId && networkService) {
    const syncHistoricalPosts = async () => {
      setSyncing(true);
      setSyncError(null);
      try {
        const node = networkService.getNode?.();
        if (node) {
          const { getPostSyncService } = await import('../services/postSyncService');
          const postService = await import('../services/postService').then(m => m.createPostService());
          const syncService = getPostSyncService(node, postService);
          const peers = await node.getConnectedPeers();
          // Request from multiple peers for redundancy
          for (const peer of peers.slice(0, 3)) {
            await syncService.requestHistoricalPosts(peer.toString(), channelId);
          }
        }
      } catch (err) {
        console.error('Sync failed:', err);
        setSyncError('Failed to sync history');
      } finally {
        setSyncing(false);
      }
    };
    syncHistoricalPosts();
  }
}, [type, channelId, networkService]);

// Export sync state
return {
  posts,
  loading,
  error,
  refresh,
  syncing,      // NEW
  syncError,    // NEW
};
```

**Modify:** `apps/browser/src/screens/Now.tsx`

**⚠️ CONCERNS:**
- Sync indicator should not be intrusive
- Need to show sync progress

**Changes:**
```typescript
// Destructure sync state from useFeed
const { posts: hookPosts, loading, error, refresh, syncing, syncError } = useFeed('for-you');

// Add sync indicator in content (after header, before posts)
{syncing && (
  <div
    data-testid="sync-indicator"
    style={{
      textAlign: 'center',
      padding: '10px',
      background: '#e8f4fd',
      borderRadius: '8px',
      marginBottom: '16px',
      fontSize: '14px',
      color: '#1da1f2',
    }}
  >
    🔄 Synchronizing channel history...
  </div>
)}

{syncError && (
  <div
    data-testid="sync-error"
    style={{
      textAlign: 'center',
      padding: '10px',
      background: '#ffeef0',
      borderRadius: '8px',
      marginBottom: '16px',
      fontSize: '14px',
      color: '#e0245e',
    }}
  >
    ⚠️ {syncError}
  </div>
)}
```

---

## Phase 3: Tests (4 hours)

### 3.1 Unit Tests (2h)

**File:** `apps/browser/tests/protocol/file.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileProtocol } from '../../src/protocol/file.js';

describe('FileProtocol', () => {
  it('should compute file hash', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const hash = await FileProtocol.computeHash(file);
    expect(hash).toHaveLength(64); // SHA-256 hex length
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('should reject files over size limit', async () => {
    // Create 101MB file
    const largeFile = new File([new ArrayBuffer(101 * 1024 * 1024)], 'large.bin');
    const protocol = new FileProtocol({} as any);
    await expect(protocol.sendFile('peer1', largeFile))
      .rejects.toThrow('File too large');
  });
});
```

**File:** `apps/browser/tests/protocol/post.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { PostProtocol } from '../../src/protocol/post.js';

describe('PostProtocol', () => {
  it('should request historical posts', async () => {
    // Mock implementation test
  });

  it('should limit history to MAX_HISTORY_POSTS', async () => {
    // Verify MAX_HISTORY_POSTS = 100
  });
});
```

---

### 3.2 E2E Tests - CONCLUSIVE (2h - ALREADY CREATED)

**File:** `tests/e2e/essential-messaging.spec.ts` (ALREADY EXISTS)

**MUST PASS Tests (6/6 Required):**

| Test ID | Description | Verification | Test File Line |
|---------|-------------|--------------|----------------|
| FT-01 | User can attach file to post | File preview appears | 65 |
| FT-02 | User can download file from post | Download event fires | 114 |
| HS-01 | New user receives channel history | Bob receives Alice's posts | 188 |
| HS-02 | Posts are deduplicated by ID | No duplicates after resync | 251 |
| OF-01 | Messages queued when offline | IndexedDB queue count > 0 | 308 |
| SV-01 | Messages are signature verified | Console logs show verification | 415 |

**SHOULD PASS Tests (4/4 Recommended):**

| Test ID | Description | Verification | Test File Line |
|---------|-------------|--------------|----------------|
| FT-03 | Large file transfer (100KB) | Handles without crash | 145 |
| HS-03 | Posts sorted by timestamp | Descending order verified | 272 |
| OF-02 | App recovers from interruption | App functional after reconnect | 384 |
| CP-01 | Cross-platform discovery | Both instances find matches | 451 |

---

## Test Execution Commands

```bash
# Run all E2E tests
pnpm test:e2e -- essential-messaging.spec.ts

# Run specific test category
pnpm test:e2e -- essential-messaging.spec.ts -g "File Transfer"
pnpm test:e2e -- essential-messaging.spec.ts -g "Historical Sync"
pnpm test:e2e -- essential-messaging.spec.ts -g "Offline"

# Run with video for debugging
pnpm test:e2e -- essential-messaging.spec.ts --video=on

# Run unit tests
pnpm test -- protocol/
```

---

## Pass/Fail Criteria

### MUST PASS (Production Blockers) - 6/6 Required

| Test | Why Critical | Failure Impact |
|------|--------------|----------------|
| FT-01 | Core messaging feature | Cannot share files |
| FT-02 | Core messaging feature | Cannot download files |
| HS-01 | Usability requirement | New users see empty feeds |
| HS-02 | Data integrity | Duplicate posts corrupt UX |
| OF-01 | Reliability requirement | Messages lost when offline |
| SV-01 | Security requirement | Unsigned messages accepted |

### SHOULD PASS (Quality Indicators) - 4/4 Recommended

| Test | Why Important | Failure Impact |
|------|---------------|----------------|
| FT-03 | Performance/stress | Large files crash app |
| HS-03 | UX quality | Posts in wrong order |
| OF-02 | Resilience | App crashes on reconnect |
| CP-01 | Interoperability | Cannot discover peers |

---

## Completion Checklist

**Phase 1 Complete When:**
- [ ] File protocol handler created (`protocol/file.ts`)
- [ ] File transfer service working (`services/fileTransferService.ts`)
- [ ] UI attachment button works (`ComposePost.tsx`)
- [ ] File download from posts works (`Post.tsx`)
- [ ] Unit tests pass (`file.test.ts`)
- [ ] E2E tests FT-01, FT-02, FT-03 pass

**Phase 2 Complete When:**
- [ ] Post protocol handler created (`protocol/post.ts`)
- [ ] Post sync service working (`services/postSyncService.ts`)
- [ ] Historical sync triggers on channel select (`useFeed.ts`)
- [ ] Sync indicator displays (`NowScreen.tsx`)
- [ ] Unit tests pass (`post.test.ts`)
- [ ] E2E tests HS-01, HS-02, HS-03 pass

**Phase 3 Complete When:**
- [ ] **ALL E2E tests pass (10/10)** ← CONCLUSIVE
- [ ] Manual verification complete
- [ ] No console errors during flows

**Total Estimated Time:** 19 hours

---

## Success Metrics

**100% Pass Rate Required for Production:**
- 6/6 MUST PASS tests
- 4/4 SHOULD PASS tests (recommended)

**Any failure means:**
- Feature is NOT production-ready
- Fix required before deployment
- Retest after fix

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File transfer complexity | Medium | High | Simple chunked transfer, no resumable downloads |
| Historical sync performance | Medium | Medium | Limit to 100 posts, concurrent requests to 3 peers |
| E2E test flakiness | Low | High | Playwright retries (2), explicit waits, 180s timeout |
| Memory issues with large files | Medium | Medium | 100MB limit, cleanup old staged files |
| IndexedDB quota exceeded | Low | Medium | Limit staged files to 50, cleanup on overflow |

---

## Conclusion

**If these 10 E2E tests pass, the feature IS production-ready. No excuses.**

These tests are conclusive because they:
1. Test real user workflows (not synthetic)
2. Verify data integrity (deduplication, ordering)
3. Test failure modes (offline, network interruption)
4. Measure performance (large files)
5. Verify security (signature verification)
6. Test interoperability (cross-platform discovery)

**All 11 UI/UX flows will be complete after this TODO.**
