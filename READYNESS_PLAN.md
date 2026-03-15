# ISC General-Purpose Readiness Plan

**Assessment Date:** 2026-03-15  
**Current State:** ~60% production-ready  
**Estimated Effort:** 54-81 hours (7-10 working days)

---

## Executive Summary

The ISC codebase has solid architectural foundations but requires critical fixes before general-purpose deployment. Key issues:

1. **Non-deterministic behavior** in production code (random similarity values)
2. **Incomplete dependency injection** (null services in critical paths)
3. **Security gaps** (unsigned posts allowed)
4. **Missing TUI source files**
5. **Test fragility** from implementation coupling

---

## Phase 1: Critical Fixes (Week 1-2)

**Goal:** Eliminate non-deterministic and insecure behavior

### 1.1 Fix Random Similarity Calculation
**File:** `apps/browser/src/social/posts.ts:146`  
**Issue:** `calculateContentSimilarity()` returns `Math.random()`  
**Fix:** Integrate real embedding service with cosine similarity  
**Effort:** 3-4 hours

```typescript
// Current (BROKEN)
function calculateContentSimilarity(content: string, _queryEmbedding: number[]): number {
  return Math.random(); // TODO: Implement real similarity
}

// Target
function calculateContentSimilarity(content: string, queryEmbedding: number[]): number {
  const contentEmbedding = embeddingService.embed(content);
  return cosineSimilarity(contentEmbedding, queryEmbedding);
}
```

### 1.2 Implement Null Dependencies
**File:** `apps/browser/src/index.tsx:54-58`  
**Issue:** Core services initialized as `null`  
**Fix:** Wire up identity, settings, video, chat, discovery services  
**Effort:** 8-12 hours

### 1.3 Require Signed Posts
**File:** `apps/browser/src/services/postService.ts:93-103`  
**Issue:** Unsigned posts created when identity unavailable  
**Fix:** Fail gracefully or require identity before post creation  
**Effort:** 2-3 hours

### 1.4 Recover TUI Source Files
**File:** `apps/tui/src/`  
**Issue:** Source files missing (only package.json exists)  
**Fix:** Investigate git history or recreate TUI implementation  
**Effort:** 8-16 hours

---

## Phase 2: Core Functionality (Week 3-4)

**Goal:** Complete user-facing features

### 2.1 WebRTC Chat Integration
**File:** `apps/browser/src/screens/Chats.tsx:141`  
**Issue:** Messages don't send via WebRTC when connected  
**Fix:** Complete WebRTC data channel integration  
**Effort:** 4-6 hours

### 2.2 Post Actions
**File:** `apps/browser/src/components/PostList.tsx:41-51`  
**Issue:** Like, repost, reply are console.log stubs  
**Fix:** Implement real social interactions  
**Effort:** 3-4 hours

### 2.3 Following Feed
**File:** `apps/browser/src/services/feedService.ts:54`  
**Issue:** `getFollowingFeed()` returns all posts  
**Fix:** Filter by followed user graph  
**Effort:** 2-3 hours

### 2.4 DHT Performance
**Files:** `apps/browser/src/network/dht.ts:120-145`, `:17`  
**Issues:** Sequential queries, single bootstrap peer  
**Fix:** Parallel queries, add 3-5 bootstrap peers  
**Effort:** 3-4 hours

---

## Phase 3: Test Hardening (Week 5)

**Goal:** Enable UI iteration without breaking tests

### 3.1 Replace Brittle Selectors
**File:** `tests/e2e/browser-flows.spec.ts:23-36`  
**Issue:** Tests depend on placeholder text and button labels  
**Fix:** Add `data-testid` attributes to all interactive elements  
**Effort:** 1-2 hours

### 3.2 Eliminate Fixed Timeouts
**Files:** `tests/e2e/*.spec.ts` (multiple)  
**Issue:** `waitForTimeout(3000)` causes flaky tests  
**Fix:** Use `waitForSelector`, `waitForResponse`, `waitForFunction`  
**Effort:** 2-4 hours

### 3.3 Add Onboarding Tests
**File:** `tests/e2e/ui-health.spec.ts:17-21`  
**Issue:** Onboarding skipped via localStorage manipulation  
**Fix:** Test actual onboarding flow  
**Effort:** 2-3 hours

---

## Phase 4: Code Quality (Week 6-7)

**Goal:** Refactor to AGENTS.md standards

### 4.1 Split Large Components
| Component | File | Lines | Target |
|-----------|------|-------|--------|
| VideoHandler | `apps/browser/src/video/handler.ts` | 570+ | Split into `VideoService`, `WebRTCManager`, `UIController` |
| ChatsScreen | `apps/browser/src/screens/Chats.tsx` | 280+ | Split into `ConversationList`, `MessageView`, `ChatScreen` |
| NowScreen | `apps/browser/src/screens/Now.tsx` | 180+ | Extract `FeedManager` hook |

**Effort:** 10-12 hours

### 4.2 State Sync Conflict Resolution
**File:** `apps/browser/src/state/sync.ts`  
**Issue:** No conflict resolution for concurrent updates  
**Fix:** Implement last-write-wins or vector clocks  
**Effort:** 3-4 hours

### 4.3 Error Handling Context
**Files:** `apps/browser/src/services/networkService.ts`, `apps/browser/src/hooks/index.ts`  
**Issue:** Generic catch blocks lose error context  
**Fix:** Wrap in `AppError` with metadata  
**Effort:** 2-3 hours

---

## Phase 5: Polish (Week 8)

**Goal:** Code quality and performance optimization

### 5.1 Standardize Imports
**Issue:** Mixed import styles (named, namespace, type)  
**Fix:** Consistent pattern: stdlib → third-party → local, named imports preferred  
**Effort:** 3-4 hours

### 5.2 Fix Naming Conventions
**Issues:** `StateSyncServiceClass` (redundant), `SUPERNOSE_UNAVAILABLE` (typo)  
**Effort:** 1 hour

### 5.3 Cache Limits
**File:** `apps/browser/src/services/feedService.ts:17-19`  
**Issue:** Unbounded `Map` growth  
**Fix:** LRU cache with max size  
**Effort:** 1 hour

---

## Test Strategy: Avoiding Brittle Tests

### Current Problems
1. Tests select by placeholder text → breaks on copy changes
2. Tests select by button text → breaks on label changes
3. Tests use fixed timeouts → flaky on slow CI
4. Tests check component structure → breaks on refactors

### Solution: Contract-Based Testing

```typescript
// ❌ Brittle: depends on implementation
await page.click('button:has-text("Add context")');

// ✅ Robust: depends on contract
await page.getByTestId('action-add-context').click();

// ❌ Brittle: fixed timeout
await page.waitForTimeout(3000);

// ✅ Robust: wait for condition
await page.waitForFunction(() => document.readyState === 'complete');
await expect(page.getByTestId('feed-posts')).toBeVisible();
```

### Test Data Attributes Convention

| Element Type | Attribute | Example |
|--------------|-----------|---------|
| Navigation | `data-testid="nav-{name}"` | `nav-tab-home`, `nav-tab-chats` |
| Actions | `data-testid="action-{name}"` | `action-like`, `action-repost` |
| Content | `data-testid="content-{type}"` | `content-post`, `content-comment` |
| Forms | `data-testid="form-{name}"` | `form-compose`, `form-login` |
| States | `data-testid="state-{name}"` | `state-loading`, `state-error` |

---

## Code Quality Checklist (AGENTS.md Compliance)

### Before Any PR, Verify:

- [ ] **Elegant**: No unnecessary complexity
- [ ] **Consolidated**: Related logic in one place
- [ ] **Consistent**: Follows existing patterns
- [ ] **Organized**: Logical file/folder structure
- [ ] **DRY**: No duplication (extract to shared module)
- [ ] **Abstract**: Parameterized, not hardcoded
- [ ] **Modularized**: Single responsibility per function/class
- [ ] **Terse syntax**: Ternary, optional chaining, array methods
- [ ] **Few comments**: Self-documenting code
- [ ] **No mocks**: Test real behavior
- [ ] **Error handling**: Specific types, context preserved
- [ ] **Performance**: No hot path object creation
- [ ] **Naming**: Descriptive, no abbreviations
- [ ] **Imports**: Grouped, sorted, named imports
- [ ] **Functions**: < 50 lines, single responsibility

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TUI files unrecoverable | Medium | High | Recreate from scratch (16h) |
| WebRTC NAT traversal fails | High | Medium | Add TURN server config |
| DHT bootstrap peers offline | Medium | High | Add 5+ diverse bootstrap peers |
| Embedding model load fails | Low | Medium | Fallback to stub (already exists) |
| Test suite too slow | Medium | Low | Parallel test execution |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] `calculateContentSimilarity()` uses real embeddings
- [ ] All DI container services non-null
- [ ] Posts require signatures (or fail with clear error)
- [ ] TUI source files exist and build

### Phase 2 Complete When:
- [ ] Chat messages send via WebRTC
- [ ] Like/repost/reply update UI and persist
- [ ] Following feed shows only followed users
- [ ] DHT queries parallel, 3+ bootstrap peers

### Phase 3 Complete When:
- [ ] All tests use `data-testid` selectors
- [ ] Zero `waitForTimeout()` calls in tests
- [ ] Onboarding flow tested end-to-end
- [ ] CI test pass rate > 95%

### Phase 4 Complete When:
- [ ] No file > 500 lines (except generated)
- [ ] No function > 50 lines
- [ ] State sync handles concurrent updates
- [ ] All errors wrapped with context

### Phase 5 Complete When:
- [ ] Consistent import order across all files
- [ ] Zero naming convention violations
- [ ] All caches bounded with LRU eviction
- [ ] AGENTS.md checklist passes for all new code

---

## Recommended Next Steps

1. **Start Phase 1 immediately** - Fix random similarity (Issue 1.1)
2. **Investigate TUI files** - Check git history for deleted files
3. **Add data-testid attributes** - Low effort, high test stability gain
4. **Set up CI monitoring** - Track test flakiness metrics

---

## Appendix: File Inventory

### Critical Files Requiring Changes
| Path | Lines | Issues | Priority |
|------|-------|--------|----------|
| `apps/browser/src/social/posts.ts` | 200+ | Random similarity | Critical |
| `apps/browser/src/index.tsx` | 100+ | Null dependencies | Critical |
| `apps/browser/src/services/postService.ts` | 150+ | Unsigned posts | Critical |
| `apps/browser/src/screens/Chats.tsx` | 280+ | WebRTC incomplete, too large | High |
| `apps/browser/src/video/handler.ts` | 570+ | Too large | Medium |
| `apps/browser/src/services/feedService.ts` | 200+ | Following feed broken | High |
| `apps/browser/src/network/dht.ts` | 180+ | Sequential queries | High |
| `tests/e2e/browser-flows.spec.ts` | 200+ | Brittle selectors | High |

### Files Meeting Standards (Reference Examples)
| Path | Why It's Good |
|------|---------------|
| `packages/core/src/math/cosine.ts` | Focused, tested, no TODOs |
| `packages/crypto/src/encryption.ts` | Proper error handling |
| `tests/unit/crypto.test.ts` | Real behavior, no mocks |
| `packages/network/src/embedding.ts` | Fallback handling, typed |
