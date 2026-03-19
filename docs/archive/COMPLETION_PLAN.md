# ISC Accelerated MVP - Completion Plan

**Branch**: `accel-mvp-2026-03`  
**Date**: March 12, 2026  
**Status**: Core MVP Complete - Remaining Items Below

---

## Executive Summary

The Accelerated MVP is **functionally complete** for core user flows:
- ✅ CLI: init, announce, query, supernode (all working)
- ✅ Browser: Channels, Discover, Chats, Settings (all working)
- ✅ Real libp2p DHT (no mocks)
- ✅ Real WebRTC chat (no mocks)
- ✅ Real persistence (IndexedDB + localStorage)
- ✅ Cross-tab synchronization
- ✅ Process cleanup (no orphan processes)

**Remaining items are enhancements, not blockers.** This plan details the work to reach production-ready state.

---

## Priority 1: Critical Gaps (Week 1)

### 1.1 Real Embedding Model Integration

**Current State**: Using SHA-256 hash stub for embeddings  
**Problem**: Semantic matching quality is poor; same text = same vector, no true semantic understanding  
**Impact**: Users with similar but differently-worded thoughts won't match

**Files to Modify**:
- `apps/browser/src/channels/manager.ts` - Add model loading
- `apps/browser/src/screens/Compose.tsx` - Use real embedding on save
- `apps/browser/src/screens/Discover.tsx` - Use real embedding for queries
- `apps/cli/src/commands/announce.ts` - Optional: add model loading
- `packages/adapters/src/browser/model.ts` - Already exists, needs activation

**Implementation Steps**:
1. Add `@xenova/transformers.js` to browser dependencies
2. Create `EmbeddingService` singleton with lazy loading
3. Replace SHA-256 stub with `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')`
4. Cache embeddings in IndexedDB to avoid recomputation
5. Add loading indicator during model download (22MB)
6. Fallback to stub if model fails to load

**Success Criteria**:
- [ ] Model downloads on first use (<30s on broadband)
- [ ] Subsequent loads use cached model (<3s)
- [ ] "AI ethics" and "machine learning morality" produce similar vectors (cosine > 0.7)
- [ ] Fallback to stub works offline

**Estimated Effort**: 4-6 hours

---

### 1.2 Video Call E2E Testing

**Current State**: Infrastructure exists (`apps/browser/src/video/`) but untested  
**Problem**: Unknown if video calls actually work  
**Impact**: Feature may be broken in production

**Files to Review**:
- `apps/browser/src/video/handler.ts` - Call creation/joining logic
- `apps/browser/src/video/types.ts` - Type definitions
- `apps/browser/src/components/VideoCallUI.tsx` - UI component
- `apps/browser/src/screens/VideoCalls.tsx` - Screen component

**Implementation Steps**:
1. Manual test: Open two browser tabs, create call in one, join from other
2. Verify WebRTC peer connection establishes
3. Verify video/audio streams exchange
4. Add error handling for camera/mic permissions
5. Add Playwright E2E test (may require mock media devices)
6. Add call quality indicator (connection status, bitrate)

**Success Criteria**:
- [ ] Two tabs can establish video call
- [ ] Video streams display correctly
- [ ] Audio works bidirectionally
- [ ] Graceful handling of permission denials
- [ ] E2E test passes in CI

**Estimated Effort**: 3-4 hours

---

## Priority 2: Essential Enhancements (Week 2)

### 2.1 Real-Time Message Delivery

**Current State**: Messages sent via WebRTC but no delivery confirmation  
**Problem**: User doesn't know if message was received  
**Impact**: Poor UX, uncertainty about message delivery

**Files to Modify**:
- `apps/browser/src/chat/webrtc.ts` - Add delivery acks
- `apps/browser/src/screens/Chats.tsx` - Show delivery status

**Implementation Steps**:
1. Add message status enum: `pending | sent | delivered | read`
2. Send acknowledgment on message receive
3. Update message status in localStorage
4. Display status indicators (✓ sent, ✓✓ delivered, ✓✓ blue read)
5. Add timeout for pending messages (retry or show failed)

**Success Criteria**:
- [ ] Messages show "sending" spinner initially
- [ ] Changes to "delivered" when peer receives
- [ ] Failed messages show retry option
- [ ] Status persists across page reloads

**Estimated Effort**: 2-3 hours

---

### 2.2 Typing Indicators

**Current State**: No typing indicators in chat  
**Problem**: Users don't know when other person is typing  
**Impact**: Conversation flow feels stilted

**Files to Modify**:
- `apps/browser/src/chat/webrtc.ts` - Add typing message type
- `apps/browser/src/screens/Chats.tsx` - Display typing indicator

**Implementation Steps**:
1. Add typing message type: `{ type: 'typing', channelID, timestamp }`
2. Send typing event on input (debounced, 1s cooldown)
3. Display "Peer is typing..." in chat panel
4. Clear typing indicator after 3s timeout or message received

**Success Criteria**:
- [ ] "Peer is typing..." appears when other user types
- [ ] Disappears after message sent or 3s timeout
- [ ] No spam (debounced to max 1 event per 2s)

**Estimated Effort**: 1-2 hours

---

### 2.3 Message Notifications

**Current State**: No notifications for new messages  
**Problem**: Users don't know they have new messages when not on Chats tab  
**Impact**: Delayed responses, poor engagement

**Files to Modify**:
- `apps/browser/src/App.tsx` - Request notification permission
- `apps/browser/src/chat/webrtc.ts` - Trigger notifications
- `apps/browser/src/components/TopNav.tsx` - Show badge count

**Implementation Steps**:
1. Request Notification permission on first chat
2. On new message (when tab not focused), show browser notification
3. Update badge count in TopNav
4. Click notification → navigate to Chats tab
5. Clear badge when chat opened

**Success Criteria**:
- [ ] Browser notification appears for new messages
- [ ] Badge count accurate in TopNav
- [ ] Clicking notification opens correct conversation
- [ ] Respects user notification preferences

**Estimated Effort**: 2-3 hours

---

## Priority 3: UX Polish (Week 3)

### 3.1 Loading States & Error Handling

**Current State**: Minimal loading indicators, generic errors  
**Problem**: Users don't know what's happening during operations  
**Impact**: Confusion, perceived slowness

**Files to Modify**: All screen components

**Implementation Steps**:
1. Add skeleton loaders for feeds, match lists, conversations
2. Add specific error messages (network error, permission denied, etc.)
3. Add retry buttons for failed operations
4. Add progress indicators for long operations (model download, DHT sync)

**Success Criteria**:
- [ ] All async operations show loading state
- [ ] Errors are specific and actionable
- [ ] Retry available for transient failures
- [ ] No infinite loading spinners

**Estimated Effort**: 4-5 hours

---

### 3.2 Onboarding Flow

**Current State**: No onboarding; users dropped into app  
**Problem**: New users don't know what to do  
**Impact**: High bounce rate, low activation

**Files to Create**:
- `apps/browser/src/screens/Onboarding.tsx` - New onboarding screens
- `apps/browser/src/components/OnboardingModal.tsx` - Modal component

**Implementation Steps**:
1. Detect first-time users (localStorage flag)
2. Show 3-step onboarding:
   - Step 1: "What are you thinking about?" (create first channel)
   - Step 2: "Find thought neighbors" (explain Discover)
   - Step 3: "Start chatting" (explain Chats)
3. Skip onboarding for returning users
4. Add "Take tour" option in Settings for later

**Success Criteria**:
- [ ] First-time users see onboarding
- [ ] Onboarding completes in <60s
- [ ] Users create first channel during onboarding
- [ ] Returning users skip onboarding

**Estimated Effort**: 3-4 hours

---

### 3.3 Empty State Improvements

**Current State**: Generic "No posts yet" messages  
**Problem**: Users don't know what to do next  
**Impact**: Confusion, abandonment

**Files to Modify**: All screen components with empty states

**Implementation Steps**:
1. Now tab empty: "Create your first post!" + button
2. Discover empty: "Create a channel to find matches" + button
3. Chats empty: "Find peers in Discover" + button
4. Following empty: "Follow people to see their posts" + suggestions

**Success Criteria**:
- [ ] All empty states have clear call-to-action
- [ ] Buttons navigate to correct screens
- [ ] Helpful explanatory text

**Estimated Effort**: 2-3 hours

---

## Priority 4: Performance Optimization (Week 4)

### 4.1 Bundle Size Reduction

**Current State**: 621KB bundle (208KB gzipped)  
**Problem**: Large bundle = slow initial load  
**Impact**: High bounce rate on slow connections

**Files to Modify**: Build configuration

**Implementation Steps**:
1. Code-split by route (lazy load screens)
2. Lazy load libp2p only when needed (not on initial load)
3. Lazy load transformers.js model
4. Tree-shake unused dependencies
5. Analyze bundle with `rollup-plugin-visualizer`

**Target**: <300KB initial bundle, <100KB gzipped

**Estimated Effort**: 4-6 hours

---

### 4.2 DHT Query Optimization

**Current State**: Queries all 20 LSH buckets sequentially  
**Problem**: Slow match discovery  
**Impact**: Users wait >10s for matches

**Files to Modify**:
- `apps/browser/src/network/dht.ts` - Parallel queries
- `apps/browser/src/screens/Discover.tsx` - Progressive display

**Implementation Steps**:
1. Query LSH buckets in parallel (Promise.all)
2. Display matches as they arrive (progressive rendering)
3. Cache query results (5min TTL)
4. Background refresh of cached results

**Target**: <5s to first match, <10s for full results

**Estimated Effort**: 2-3 hours

---

### 4.3 IndexedDB Performance

**Current State**: Synchronous reads blocking UI  
**Problem**: Janky UI during data operations  
**Impact**: Poor perceived performance

**Files to Modify**:
- `apps/browser/src/db/helpers.ts` - Add async wrappers
- All components using IndexedDB

**Implementation Steps**:
1. Use async IndexedDB with proper transactions
2. Add read caching (in-memory LRU cache)
3. Batch writes where possible
4. Use IndexedDB observers for real-time updates

**Estimated Effort**: 3-4 hours

---

## Priority 5: Security Hardening (Week 5)

### 5.1 Signature Verification

**Current State**: Signatures created but not always verified  
**Problem**: Malicious peers could inject fake announcements  
**Impact**: Security vulnerability

**Files to Modify**:
- `apps/browser/src/network/dht.ts` - Verify on receive
- `apps/browser/src/social/posts.ts` - Verify posts
- `apps/browser/src/chat/webrtc.ts` - Verify messages

**Implementation Steps**:
1. Verify all DHT announcements on receive
2. Verify all posts before displaying
3. Verify all chat messages
4. Show warning for unverified content
5. Block peers with invalid signatures

**Success Criteria**:
- [ ] 100% of incoming data verified
- [ ] Invalid signatures rejected silently
- [ ] Repeated invalid signatures → peer blocked

**Estimated Effort**: 4-5 hours

---

### 5.2 Rate Limit Enforcement

**Current State**: Client-side rate limits only  
**Problem**: Malicious clients can bypass  
**Impact**: Spam, DoS vulnerability

**Files to Modify**:
- `apps/browser/src/rateLimit.ts` - Enforce limits
- `apps/browser/src/network/dht.ts` - Track per-peer rates

**Implementation Steps**:
1. Track announce rate per peer (5/min)
2. Track query rate per peer (30/min)
3. Track chat dial rate per peer (20/hr)
4. Block peers exceeding limits
5. Exponential backoff for violations

**Success Criteria**:
- [ ] Rate limits enforced client-side
- [ ] Violations logged
- [ ] Repeat offenders blocked

**Estimated Effort**: 2-3 hours

---

### 5.3 Content Sanitization

**Current State**: No XSS protection  
**Problem**: Malicious posts could execute scripts  
**Impact**: XSS vulnerability

**Files to Modify**:
- `apps/browser/src/components/Post.tsx` - Sanitize content
- `apps/browser/src/screens/Chats.tsx` - Sanitize messages

**Implementation Steps**:
1. Add `dompurify` dependency
2. Sanitize all user-generated content before rendering
3. Escape HTML entities
4. Block script tags, event handlers, javascript: URLs

**Success Criteria**:
- [ ] `<script>` tags rendered as text
- [ ] `onclick` handlers stripped
- [ ] `javascript:` URLs blocked

**Estimated Effort**: 1-2 hours

---

## Priority 6: Testing & QA (Week 6)

### 6.1 Playwright E2E Coverage

**Current State**: Basic E2E tests exist  
**Problem**: Incomplete coverage  
**Impact**: Bugs in production

**Files to Create**:
- `tests/e2e/chat-flow.spec.ts` - Complete chat flow
- `tests/e2e/channel-lifecycle.spec.ts` - Create/edit/delete
- `tests/e2e/offline-sync.spec.ts` - Offline operations

**Implementation Steps**:
1. Test complete chat flow (create channel → discover → chat)
2. Test channel lifecycle (create → edit → delete)
3. Test offline operations (create post offline → sync online)
4. Test cross-tab synchronization
5. Run in CI on every PR

**Success Criteria**:
- [ ] 80%+ critical path coverage
- [ ] All tests pass in CI
- [ ] Tests run in <10min

**Estimated Effort**: 6-8 hours

---

### 6.2 Performance Benchmarks

**Current State**: No performance monitoring  
**Problem**: Don't know if performance degrades  
**Impact**: Slow regression detection

**Files to Create**:
- `tests/benchmarks/match-discovery.bench.ts` - Time to first match
- `tests/benchmarks/message-delivery.bench.ts` - Message latency
- `tests/benchmarks/bundle-size.bench.ts` - Bundle size tracking

**Implementation Steps**:
1. Measure time-to-first-match (target: <10s)
2. Measure message delivery latency (target: <2s)
3. Track bundle size over time (target: <300KB)
4. Track memory usage (target: <200MB idle)
5. Run benchmarks weekly, alert on regression

**Success Criteria**:
- [ ] All benchmarks automated
- [ ] Baselines established
- [ ] Regression alerts configured

**Estimated Effort**: 3-4 hours

---

## Priority 7: Documentation (Week 7)

### 7.1 User Documentation

**Files to Create**:
- `docs/GETTING_STARTED.md` - User guide
- `docs/FAQ.md` - Common questions
- `docs/TROUBLESHOOTING.md` - Problem resolution

**Contents**:
- How to create account (none needed)
- How to create channels
- How to find matches
- How to chat
- Privacy guarantees
- Common issues and fixes

**Estimated Effort**: 4-5 hours

---

### 7.2 Developer Documentation

**Files to Create**:
- `docs/ARCHITECTURE.md` - System architecture
- `docs/CONTRIBUTING.md` - How to contribute
- `docs/API.md` - Internal API reference

**Contents**:
- Architecture diagrams
- Data flow explanations
- Package structure
- Development setup
- Testing guidelines
- Deployment process

**Estimated Effort**: 4-5 hours

---

## Summary: Effort Estimates

| Priority | Items | Total Hours |
|----------|-------|-------------|
| P1: Critical Gaps | 2 items | 7-10h |
| P2: Essential Enhancements | 3 items | 5-8h |
| P3: UX Polish | 3 items | 9-12h |
| P4: Performance | 3 items | 9-13h |
| P5: Security | 3 items | 7-10h |
| P6: Testing & QA | 2 items | 9-12h |
| P7: Documentation | 2 items | 8-10h |
| **Total** | **18 items** | **54-75h** |

---

## Recommended Execution Order

**Week 1**: P1 (Critical Gaps) - Real embeddings, video call testing  
**Week 2**: P2 (Essential Enhancements) - Delivery acks, typing, notifications  
**Week 3**: P3 (UX Polish) - Loading states, onboarding, empty states  
**Week 4**: P4 (Performance) - Bundle size, DHT optimization, IndexedDB  
**Week 5**: P5 (Security) - Signatures, rate limits, sanitization  
**Week 6**: P6 (Testing) - E2E coverage, benchmarks  
**Week 7**: P7 (Documentation) - User and dev docs  

---

## STOP HERE

**Do not execute this plan yet.** This document is for planning purposes only. Await further instructions before proceeding with implementation.

---

**Current Branch Status**: `accel-mvp-2026-03`  
**Last Commit**: ea8790c FIX: Add cross-tab synchronization  
**Build Status**: ✅ All 6 packages build successfully  
**Bundle Size**: 621KB (208KB gzipped)
