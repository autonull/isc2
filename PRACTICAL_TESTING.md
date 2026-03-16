# ISC Practical Functionality Test Guide

**Purpose:** Actually verify the app works for real users, not just that code builds.

**Status:** ✅ **REALITY CHECK PASSES - App is functional**

---

## Automated Reality Check (Recommended)

Run this script to automatically test real functionality:

```bash
pnpm reality-check
```

This will:
1. Build browser, CLI, and TUI
2. Start the browser app
3. Use Playwright to actually click and verify UI
4. Test CLI commands work
5. Test network simulation proves DHT works
6. Report real pass/fail status

**Expected output:**
```
✅ REALITY CHECK PASSED
The app actually works! No critical issues found.
```

---

## Manual Quick Check (5 minutes)

If you prefer to test manually:

### 1. Browser UI - Can you actually use it?

```bash
# Start the browser app
pnpm dev:browser
```

**Expected:** Server starts at http://localhost:5173

**Manual Tests:**
1. Open http://localhost:5173 in your browser
2. Do you see the app UI (not a blank page)?
3. Can you click the navigation tabs (Now, Discover, Video, Chats, Settings)?
4. Does the sidebar show channels or a prompt to create one?
5. Can you create a channel? (Click "+" or "New Channel")
6. Can you create a post in that channel?
7. Does the post appear in the feed?

**If any of these fail:** The UI has real issues despite passing tests.

---

### 2. TUI - Does it actually run?

```bash
# Start the terminal UI
pnpm dev:tui
```

**Expected:** You see a terminal interface with:
- `[CHANNELS]` section
- `[MATCHES]` section  
- `[POSTS]` section
- Status bar at bottom

**Manual Tests:**
1. Do you see the interface (not errors)?
2. Press `n` - does it prompt for channel name?
3. Type a name, press Enter - does it prompt for description?
4. Type description, press Enter - does channel appear in list?
5. Press `p` - does it prompt for a post?
6. Type a post, press Enter - does it appear in posts?
7. Press `q` - does it exit cleanly?

**If any of these fail:** TUI is broken despite passing smoke tests.

---

### 3. CLI - Do commands actually work?

```bash
# Test CLI commands
node apps/cli/dist/index.js --help
node apps/cli/dist/index.js status
node apps/cli/dist/index.js identity show
```

**Expected:**
- `--help` shows command list
- `status` shows system status
- `identity show` shows identity info or prompts to create one

**If these fail:** CLI is broken despite build passing.

---

### 4. Network Simulation - Does peer discovery work?

```bash
# Run network simulation (proves DHT communication works)
pnpm --filter @isc/apps/net-sim test:simple
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════
                      RESULTS
═══════════════════════════════════════════════════════════
  Peers: 4
  DHT Announcements: 4
  Total Matches: 2
  Peers with Matches: 2/4

  ✅ SUCCESS - Network communication verified!
  ✅ Semantic matching working!
```

**If this fails:** Network layer is broken.

---

## Comprehensive Manual Test (15 minutes)

### Browser Full Flow Test

1. **Start app:** `pnpm dev:browser`
2. **Create identity:** Follow onboarding if shown
3. **Create channel:**
   - Click "+" or "New Channel"
   - Enter name: "test-channel"
   - Enter description: "Testing"
   - Click Create
   - ✅ Channel appears in sidebar
4. **Create post:**
   - Click in compose box
   - Type: "Hello, this is a test post"
   - Click Post
   - ✅ Post appears in feed
5. **Navigate tabs:**
   - Click each tab (Now, Discover, Video, Chats, Settings)
   - ✅ Each tab shows different content
6. **Test following:**
   - Go to Discover tab
   - ✅ Shows peer discovery interface
7. **Test settings:**
   - Go to Settings tab
   - ✅ Shows settings form
8. **Refresh page:**
   - Press F5 or Cmd+R
   - ✅ Channel and post still exist (persistence works)

---

### TUI Full Flow Test

1. **Start app:** `pnpm dev:tui`
2. **Wait for connection:** Should show "connected" status
3. **Create channel:**
   - Press `n`
   - Type: "test"
   - Press Enter
   - Type: "Test channel"
   - Press Enter
   - ✅ Channel appears in list
4. **Create post:**
   - Press `p`
   - Type: "Hello from TUI"
   - Press Enter
   - ✅ Post appears
5. **Navigate:**
   - Press ↑/↓ arrows
   - ✅ Selection changes
6. **Exit:**
   - Press `q`
   - ✅ Exits cleanly

---

## Automated Reality Check Script

Run this script for automated verification of actual functionality:

```bash
bash scripts/reality-check.sh
```

This will:
1. Start browser in background
2. Use Playwright to actually click and verify UI
3. Test TUI execution
4. Test CLI commands
5. Report real pass/fail status

---

## Known Failure Points (Check These First)

If tests fail, check these common issues:

### Browser won't load
```bash
# Check if port is available
lsof -i :5173
# Kill if needed
kill -9 <PID>
```

### TUI shows errors
```bash
# Rebuild TUI
pnpm --filter @isc/apps/tui build
# Check Node version (needs 18+)
node --version
```

### CLI commands fail
```bash
# Rebuild CLI
pnpm --filter @isc/apps/cli build
# Check dist exists
ls -la apps/cli/dist/
```

### Network simulation fails
```bash
# Install dependencies
pnpm install
# Try simple test first
pnpm --filter @isc/apps/net-sim test:simple
```

---

## What To Do If Something Is Broken

1. **Don't panic** - This is why we test
2. **Note the exact error** - Screenshot or copy error message
3. **Check if it's environment-specific** - Try on different terminal/browser
4. **Look at recent changes** - `git log -n 10 --oneline`
5. **Run basic verification** - `pnpm verify` to see if tests still pass

---

## Success Criteria

The system is **actually ready** when:

- [ ] Browser loads and shows UI (not blank/error page)
- [ ] Can create channel in browser
- [ ] Can create post in browser
- [ ] Posts persist after page refresh
- [ ] TUI starts without errors
- [ ] Can create channel in TUI
- [ ] Can create post in TUI
- [ ] CLI --help shows commands
- [ ] CLI status command works
- [ ] Network simulation shows SUCCESS

**If all 10 checkboxes are ✅: The system is genuinely ready.**

**If any are ❌: We found a real issue that needs fixing.**

---

## Contact/Report Issues

If you find broken functionality:
1. Note which test failed
2. Copy the exact error message
3. Note your environment (OS, Node version, browser)
4. This helps fix the actual problem

---

**Remember:** Finding bugs now is GOOD. It means we can fix them before they cause problems in production.
