# Selector Audit: Old → New Mapping

## Screen Selectors

| Old Selector          | New Selector                      | Status            |
| --------------------- | --------------------------------- | ----------------- |
| `.feed-container`     | `[data-testid="feed-container"]`  | ✅ Migrated       |
| `.post-card`          | `[data-component="post"]`         | ✅ Both supported |
| `.like-btn`           | `[data-action="like"]`            | ✅ Migrated       |
| `.reply-btn`          | `[data-action="reply"]`           | ✅ Migrated       |
| `.discover-container` | `[data-testid="discover-screen"]` | ✅ Migrated       |
| `.match-card`         | `[data-component="match-card"]`   | ✅ Both supported |
| `.chats-container`    | `[data-testid="chats-screen"]`    | ✅ Migrated       |
| `.settings-container` | `[data-testid="settings-screen"]` | ✅ Migrated       |
| `.compose-container`  | `[data-testid="compose-screen"]`  | ✅ Migrated       |

## Component Selectors

| Selector                             | Purpose                 | Status         |
| ------------------------------------ | ----------------------- | -------------- |
| `[data-testid="*"]`                  | Primary test selector   | ✅ Recommended |
| `[data-component="*"]`               | Component type selector | ✅ Supported   |
| `[data-action="*"]`                  | Action button selector  | ✅ Recommended |
| `[data-testid="snav-*"]`             | Sidebar navigation      | ✅ Unchanged   |
| `[data-testid="modal-close"]`        | Modal close button      | ✅ Unchanged   |
| `[data-testid="peer-profile-modal"]` | Peer profile modal      | ✅ New (H1)    |

## New Feature Selectors

| Selector                             | Feature            | Phase |
| ------------------------------------ | ------------------ | ----- |
| `#aria-live-region`                  | ARIA live region   | L1    |
| `.sr-only`                           | Screen reader only | L1    |
| `[tabindex="-1"]`                    | Focusable content  | L2    |
| `:focus-visible`                     | Keyboard focus     | L4    |
| `[data-lazy="true"]`                 | Lazy-loaded posts  | M1    |
| `.post-card.loaded`                  | Loaded lazy posts  | M1    |
| `.post-card.optimistic`              | Optimistic UI      | K2    |
| `[data-testid="advanced-section"]`   | Advanced settings  | I1    |
| `[data-testid="moderation-section"]` | Moderation         | J1    |
| `[data-testid="share-section"]`      | Share section      | I4    |
| `[data-testid="chat-more-btn"]`      | Chat more menu     | I3    |

## Guidelines

**New Tests:**

1. Use `data-testid` for primary element selection
2. Use `data-component` for component type queries
3. Use `data-action` for button/action queries
4. Avoid CSS class selectors

**Naming Convention:**

```typescript
[data-testid="{component}-{element}"]
// Examples: [data-testid="now-screen"], [data-testid="like-btn"]
```

**Deprecation:**

- Q2 2026: Class-based selectors deprecated in new tests
- Q3 2026: Class-based selectors removed from documentation
- Q4 2026: Class-based selectors may be removed from components
