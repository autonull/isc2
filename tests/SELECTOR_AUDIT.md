# Selector Audit: Old → New Mapping

## Purpose

This document tracks selector changes for test maintenance and migration.

## Screen Selectors

### Now Screen (Feed)

| Old Selector      | New Selector                     | Status            |
| ----------------- | -------------------------------- | ----------------- |
| `.feed-container` | `[data-testid="feed-container"]` | ✅ Migrated       |
| `.post-card`      | `[data-component="post"]`        | ✅ Both supported |
| `.like-btn`       | `[data-action="like"]`           | ✅ Migrated       |
| `.reply-btn`      | `[data-action="reply"]`          | ✅ Migrated       |
| `#now-refresh`    | `#now-refresh`                   | ✅ Unchanged      |
| `.post-content`   | `[data-testid="post-content"]`   | ✅ Added          |

### Discover Screen

| Old Selector          | New Selector                      | Status            |
| --------------------- | --------------------------------- | ----------------- |
| `.discover-container` | `[data-testid="discover-screen"]` | ✅ Migrated       |
| `.match-card`         | `[data-component="match-card"]`   | ✅ Both supported |
| `#discover-btn`       | `#discover-btn`                   | ✅ Unchanged      |
| `[data-chat-btn]`     | `[data-chat-btn]`                 | ✅ Unchanged      |

### Chats Screen

| Old Selector                    | New Selector                    | Status            |
| ------------------------------- | ------------------------------- | ----------------- |
| `.chats-container`              | `[data-testid="chats-screen"]`  | ✅ Migrated       |
| `.conversation-item`            | `.conversation-item`            | ✅ Unchanged      |
| `.chat-input`                   | `#chat-input`                   | ✅ Both supported |
| `#chat-send`                    | `#chat-send`                    | ✅ Unchanged      |
| `[data-close-chat]`             | `[data-close-chat]`             | ✅ Unchanged      |
| `[data-testid="chat-more-btn"]` | `[data-testid="chat-more-btn"]` | ✅ New (I3)       |

### Settings Screen

| Old Selector                         | New Selector                         | Status       |
| ------------------------------------ | ------------------------------------ | ------------ |
| `.settings-container`                | `[data-testid="settings-screen"]`    | ✅ Migrated  |
| `#profile-form`                      | `#profile-form`                      | ✅ Unchanged |
| `#clear-data`                        | `#clear-data`                        | ✅ Unchanged |
| `[data-testid="advanced-section"]`   | `[data-testid="advanced-section"]`   | ✅ New (I1)  |
| `[data-testid="moderation-section"]` | `[data-testid="moderation-section"]` | ✅ New (J1)  |
| `[data-testid="share-section"]`      | `[data-testid="share-section"]`      | ✅ New (I4)  |

### Compose Screen

| Old Selector         | New Selector                     | Status       |
| -------------------- | -------------------------------- | ------------ |
| `.compose-container` | `[data-testid="compose-screen"]` | ✅ Migrated  |
| `#compose-form`      | `#compose-form`                  | ✅ Unchanged |
| `#compose-input`     | `#compose-input`                 | ✅ Unchanged |

## Component Selectors

### Sidebar

| Old Selector                    | New Selector                    | Status       |
| ------------------------------- | ------------------------------- | ------------ |
| `.irc-layout`                   | `.irc-layout`                   | ✅ Unchanged |
| `.snav-btn`                     | `.snav-btn`                     | ✅ Unchanged |
| `[data-testid="snav-now"]`      | `[data-testid="snav-now"]`      | ✅ Unchanged |
| `[data-testid="snav-discover"]` | `[data-testid="snav-discover"]` | ✅ Unchanged |
| `[data-testid="snav-chats"]`    | `[data-testid="snav-chats"]`    | ✅ Unchanged |
| `[data-testid="snav-settings"]` | `[data-testid="snav-settings"]` | ✅ Unchanged |

### Modal

| Old Selector                         | New Selector                         | Status       |
| ------------------------------------ | ------------------------------------ | ------------ |
| `.modal-overlay`                     | `.modal-overlay`                     | ✅ Unchanged |
| `.modal`                             | `.modal`                             | ✅ Unchanged |
| `[data-testid="modal-close"]`        | `[data-testid="modal-close"]`        | ✅ Unchanged |
| `[data-testid="peer-profile-modal"]` | `[data-testid="peer-profile-modal"]` | ✅ New (H1)  |

## Accessibility Selectors (New - Phase L)

| Selector            | Purpose                        | Status           |
| ------------------- | ------------------------------ | ---------------- |
| `#aria-live-region` | Global ARIA live announcements | ✅ New (L1)      |
| `.sr-only`          | Screen reader only content     | ✅ New (L1)      |
| `[tabindex="-1"]`   | Focusable main content         | ✅ New (L2)      |
| `:focus-visible`    | Keyboard focus indicator       | ✅ Enhanced (L4) |

## Performance Selectors (New - Phase M)

| Selector                | Purpose             | Status      |
| ----------------------- | ------------------- | ----------- |
| `[data-lazy="true"]`    | Lazy-loaded posts   | ✅ New (M1) |
| `.post-card.loaded`     | Loaded lazy posts   | ✅ New (M1) |
| `.post-card.optimistic` | Optimistic UI posts | ✅ New (K2) |

## Test Helper Selectors

| Selector           | Purpose                 | Status         |
| ------------------ | ----------------------- | -------------- |
| `[data-testid]`    | Primary test selector   | ✅ Recommended |
| `[data-component]` | Component type selector | ✅ Supported   |
| `[data-action]`    | Action button selector  | ✅ Recommended |

## Migration Guidelines

### For New Tests

1. **Always use `data-testid`** for primary element selection
2. **Use `data-component`** for component type queries
3. **Use `data-action`** for button/action queries
4. **Avoid CSS class selectors** where possible

### For Existing Tests

1. Run tests with `--reporter=list` to identify failures
2. Update selectors using this mapping
3. Prefer `data-testid` over class names
4. Add `data-testid` to new elements during development

### Deprecation Timeline

- **Q2 2026**: Class-based selectors deprecated in new tests
- **Q3 2026**: Class-based selectors removed from documentation
- **Q4 2026**: Class-based selectors may be removed from components

## Selector Naming Convention

```typescript
// Format: [data-testid]="{component}-{element}"
// Examples:
'[data-testid="now-screen"]'; // Screen root
'[data-testid="post-card"]'; // Component
'[data-testid="like-btn"]'; // Action button
'[data-testid="compose-input"]'; // Form input
'[data-testid="modal-close"]'; // Modal action
```
