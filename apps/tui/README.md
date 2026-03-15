# ISC Terminal UI

IRC-style terminal interface for Internet Semantic Chat.

Like irssi/weechat but for ISC. No browser, no complexity, just works.

## Quick Start

```bash
# 1. Initialize (if not done)
pnpm --filter @isc/apps/cli dev -- init

# 2. Create a channel
pnpm --filter @isc/apps/cli dev -- channel create "General" -d "General discussion"

# 3. Run TUI
pnpm --filter @isc/apps/tui dev
```

## Controls

| Key | Action |
|-----|--------|
| `↑`/`k` | Navigate up |
| `↓`/`j` | Navigate down |
| `Enter` | Select channel |
| `n` | New channel |
| `p` | New post (when channel selected) |
| `q` | Quit |

## Features

- ✅ Channel list sidebar
- ✅ Posts view
- ✅ Create channels
- ✅ Create posts
- ✅ Keyboard navigation (vim-style)
- ✅ Mouse support
- ✅ Status bar

## Architecture

The TUI:
- Uses the **same data files** as the CLI (`isc-data/`)
- **No embedding model** - just simple storage
- **No browser dependencies** - pure Node.js
- **No complex initialization** - starts instantly

This is the reference implementation for how the browser app should work.

## Why This Works When Browser Doesn't

| Issue | Browser | TUI |
|-------|---------|-----|
| Module imports | Triggers onnxruntime | None |
| Initialization | Complex, async | None |
| Storage | IndexedDB | JSON files |
| Dependencies | transformers.js | blessed |
| Result | ❌ Fails to load | ✅ Works |

## Screenshot

```
┌─ Channels ────────────┬─ Posts ──────────────────────────────┐
│ ▶ #General            │ [now] @you: Hello world!             │
│   #Test Channel       │                                      │
│                       │                                      │
│                       │                                      │
│                       │                                      │
└───────────────────────┴──────────────────────────────────────┘
┌─ Message ────────────────────────────────────────────────────┐
│                                                              │
└──────────────────────────────────────────────────────────────┘
ISC | Channels: 2 | ↑↓ Navigate | Enter Select | q Quit | n New | p Post
```

## Development

```bash
# Run tests
node apps/tui/test.js

# Run TUI
pnpm --filter @isc/apps/tui dev

# Build
pnpm --filter @isc/apps/tui build
```
