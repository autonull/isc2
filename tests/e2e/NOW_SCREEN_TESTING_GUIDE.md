# Now Screen Redesign Testing Guide

## Philosophy: Behavior-Focused Tests

These e2e tests are designed to be **resilient to UI changes**. Instead of testing implementation details (CSS classes, exact DOM structure, pixel values), they focus on **user behavior and outcomes**.

## Resilience Principles

### ✅ What We Test
- **User Actions**: Can users post, switch views, change settings?
- **Behavioral Outcomes**: Do posts appear after submission? Does feed update after settings change?
- **User-Facing Features**: Can users access all functionality?
- **No Errors**: The page doesn't crash when users interact with it

### ❌ What We DON'T Test
- **CSS Class Names**: If `compose-bar-collapsed` changes to `compose--minimized`, tests still pass
- **Exact Dimensions**: If compose bar height changes from 40px to 45px, tests still pass
- **DOM Structure**: If a div is added/removed around an element, tests still pass
- **Animation Timing**: If CSS transition changes from 0.2s to 0.3s, tests still pass

## Test Implementation Details

### Selectors Strategy

#### Primary: `data-testid` Attributes
```typescript
// ✅ Resilient - won't break if styling changes
const composeInput = page.locator('[data-testid="compose-input"]').first();

// ❌ Brittle - breaks if CSS class changes
const composeInput = page.locator('.compose-bar .input-field.primary').first();
```

All testable elements in the Now screen use `data-testid` attributes:
- `[data-testid="compose-bar"]` - Compose input area
- `[data-testid="compose-input"]` - Text input
- `[data-testid="compose-submit"]` - Submit button
- `[data-testid="floating-toolbar"]` - Toolbar with controls
- `[data-testid="view-mode-select"]` - View mode dropdown
- `[data-testid="sort-order-select"]` - Sort dropdown
- `[data-testid="more-options-btn"]` - Advanced settings button
- `[data-testid="feed-container"]` - Feed area
- `[data-testid="network-status-badge"]` - Status indicator

#### Secondary: Semantic Selectors
```typescript
// ✅ Resilient - based on content/semantics
const closeBtn = page.locator('button:has-text("Close")').first();

// ✅ Resilient - accessible to users
const email = page.locator('input[type="email"]').first();
```

#### Avoid: CSS Classes, IDs, Positions
```typescript
// ❌ Brittle - breaks when CSS refactored
const toolbar = page.locator('.floating-toolbar.sticky-top.z-20').first();

// ❌ Brittle - breaks if positioning changes
const element = page.locator('div:nth-child(3) > span');
```

## Test Scenarios

### 1. Compose Functionality
```typescript
test('user can post a message from compose bar at top', async ({ page }) => {
  const testMessage = `Test message ${Date.now()}`;

  // Action
  await getComposeInput(page).fill(testMessage);
  await page.locator('[data-testid="compose-submit"]').click();

  // Assertion (outcome-focused)
  const msgLocator = page.locator(`text=${testMessage}`);
  expect(await msgLocator.count()).toBeGreaterThan(0);
});
```

**Why this is resilient:**
- Doesn't care where compose bar is positioned
- Doesn't care about CSS transitions
- Doesn't care about internal DOM structure
- Only cares: Can user post? Does message appear?

### 2. Smart-Hide Behavior
```typescript
test('compose bar collapses on scroll and expands on scroll-up', async ({ page }) => {
  const feed = page.locator('[data-testid="feed-container"]').first();
  const composeBar = page.locator('[data-testid="compose-bar"]').first();

  const initialHeight = await composeBar.evaluate((el) => el.offsetHeight);

  // Scroll down
  await feed.evaluate((el) => { el.scrollTop = 200; });
  await page.waitForTimeout(300);

  const collapsedHeight = await composeBar.evaluate((el) => el.offsetHeight);
  expect(collapsedHeight).toBeLessThan(initialHeight);
});
```

**Why this is resilient:**
- Tests behavior (collapses on scroll), not implementation
- Uses `.offsetHeight` which works regardless of CSS approach
- Doesn't depend on specific class names or animation times
- Flexible: works with max-height, transform, opacity, or any CSS technique

### 3. Toolbar Controls
```typescript
test('user can switch view modes from toolbar', async ({ page }) => {
  const feed = page.locator('[data-testid="feed-container"]').first();
  const initialClass = await feed.getAttribute('class');

  // Action
  await page.locator('[data-testid="view-mode-select"]').selectOption('grid');
  await page.waitForTimeout(1000);

  // Assertion (outcome-focused)
  const newClass = await feed.getAttribute('class');
  expect(newClass).not.toBe(initialClass);

  // Verify no errors
  await assertNoErrors(page);
});
```

**Why this is resilient:**
- Tests outcome (feed changed), not HOW it changed
- Doesn't depend on specific CSS classes
- Doesn't depend on animation details
- Works if implementation uses CSS, JS, or both

## Helper Functions

The `now-screen-helpers.ts` file provides **safe, reusable helpers** that abstract away brittle selectors:

```typescript
// Instead of: page.locator('[data-testid="compose-bar"]').first()
const composeBar = await getComposeBar(page);

// Instead of: checking if class contains 'collapsed'
const isCollapsed = await isComposeBarCollapsed(page);

// Instead of: manually filling input and clicking button
const success = await postMessage(page, 'Hello');
```

Benefits:
- **Single source of truth** for selectors
- **Easy to update** if `data-testid` changes
- **Consistent error handling** across tests
- **Readable test code** that describes intent, not mechanics

## Running the Tests

```bash
# Run Now screen redesign tests
npm run test:e2e -- tests/e2e/now-screen-redesign.spec.ts

# Run specific test
npm run test:e2e -- tests/e2e/now-screen-redesign.spec.ts -g "compose bar"

# Run with headed browser (see what's happening)
npm run test:e2e -- tests/e2e/now-screen-redesign.spec.ts --headed
```

## Common Test Patterns

### ✅ Test Behavior
```typescript
test('user can do X', async ({ page }) => {
  // Arrange: Setup state
  await setupChannel(page);

  // Act: User performs action
  await userAction(page);

  // Assert: Expected outcome occurred
  expect(outcomeObservable).toBe(expectedOutcome);
});
```

### ✅ Use Test IDs for Elements
```typescript
// Easy to maintain, won't break with CSS changes
const btn = page.locator('[data-testid="my-button"]');
```

### ✅ Test Real User Flows
```typescript
// Tests what users actually do
await postMessage(page, 'Hello');
await changeSortOrder(page, 'relevance');
await scrollFeedDown(page);
```

### ❌ Don't Test Implementation
```typescript
// ❌ BAD: Tests CSS implementation
expect(await composeBar.evaluate(el =>
  window.getComputedStyle(el).maxHeight
)).toBe('40px');

// ✅ GOOD: Tests observable behavior
expect(await isComposeBarCollapsed(page)).toBe(true);
```

### ❌ Don't Test Exact DOM
```typescript
// ❌ BAD: Brittle DOM structure test
const btn = page.locator('div:nth-child(2) > button:nth-of-type(1)');

// ✅ GOOD: Semantic selector
const btn = page.locator('[data-testid="refresh-btn"]');
```

## Maintenance Guidelines

### When UI Changes
1. **CSS/Styling Changes**: Tests keep passing ✅
2. **Position Changes**: Tests keep passing ✅
3. **Animation Changes**: Tests keep passing ✅
4. **DOM Restructuring**: Tests keep passing IF `data-testid` attributes preserved ✅
5. **Feature Removal**: Tests that feature should fail appropriately ⚠️

### When Tests Need Updates
Only update tests if:
- **Feature behavior changed** (e.g., smart-hide now triggers at different point)
- **Element removed** (remove `data-testid` from HTML, test fails gracefully)
- **User action changed** (e.g., now requires two clicks instead of one)
- **Assertion outcome changed** (e.g., posts now sorted differently by default)

### Minimal Changes for Maximum Coverage
```typescript
// Tests stay the same across these changes:
// ✅ .compose-bar { max-height: 40px; } → max-height: 50px;
// ✅ <div data-testid="compose-bar"> → <section data-testid="compose-bar">
// ✅ Transitions added/removed
// ✅ Grid layout changed to flexbox
// ✅ Colors/fonts changed

// Tests need update for these changes:
// ⚠️ <div data-testid="compose-bar"> → <div data-testid="compose-area">
// ⚠️ Smart-hide behavior inverted (expand on scroll down)
// ⚠️ Compose moved to bottom again
```

## Coverage

Current test suite covers:
- ✅ Compose bar functionality (posting, channel switching)
- ✅ Smart-hide behavior (scroll collapse/expand)
- ✅ View mode switching (list/grid/space)
- ✅ Precision toggle controls
- ✅ Sort order dropdown
- ✅ Advanced settings modal
- ✅ Filter toggles
- ✅ Reply context
- ✅ Network status display
- ✅ Refresh functionality
- ✅ Accessibility checks
- ✅ No unexpected overlaps
- ✅ Keyboard shortcuts (Ctrl+Enter submit)

## Future Improvements

- [ ] Test with actual network conditions (offline, slow)
- [ ] Test with real feed data variations
- [ ] Test edge cases (very long channel names, many channels)
- [ ] Test mobile responsiveness (viewport sizes)
- [ ] Test keyboard navigation (Tab, arrow keys)
- [ ] Test screen reader compatibility
- [ ] Performance tests (no jank on scroll)

## Questions?

If a test seems brittle or is failing unexpectedly:
1. Check if `data-testid` exists on the element
2. Verify selectors match the current HTML
3. Check if test is testing behavior (good) or implementation (bad)
4. Use `--headed` flag to watch the test run
