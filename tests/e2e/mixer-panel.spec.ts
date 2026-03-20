/**
 * Mixer Panel E2E Tests
 *
 * Tests for the compact Mixer Panel UI with progressive disclosure.
 * Covers: precision slider, view modes, filters, presets, channel switching.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  waitForAppReady,
  waitForVisible,
  skipOnboarding,
  injectChannels,
  getAppState,
} from './utils/testHelpers.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  page.on('pageerror', err => console.error('Uncaught error:', err.message));
  await page.goto('/');
  await skipOnboarding(page);
  await waitForAppReady(page);

  // Inject test channels
  await injectChannels(page, [
    { id: 'channel-1', name: 'Test Channel', description: 'A test channel' },
    { id: 'channel-2', name: 'Another Channel', description: 'Another test channel' },
  ]);

  await page.waitForTimeout(500);
});

// ── Mixer Panel Visibility ────────────────────────────────────────────────────

test.describe('Mixer Panel - Visibility', () => {
  test('mixer panel is visible when channel is selected', async ({ page }) => {
    await waitForVisible(page, '[data-testid="mixer-panel"]');
  });

  test('mixer panel shows channel name', async ({ page }) => {
    const channelName = await page.locator('.mixer-channel-name').textContent();
    expect(channelName).toContain('Test Channel');
  });

  test('mixer panel has expand/collapse button', async ({ page }) => {
    await expect(page.locator('#mixer-expand')).toBeVisible();
  });

  test('mixer panel has edit button', async ({ page }) => {
    await expect(page.locator('#mixer-edit')).toBeVisible();
  });

  test('mixer panel has mute button', async ({ page }) => {
    await expect(page.locator('#mixer-mute')).toBeVisible();
  });

  test('mixer panel does NOT have channel switcher dropdown', async ({ page }) => {
    // Channel switching should only happen from sidebar
    await expect(page.locator('#mixer-channel-select')).not.toBeVisible();
  });
});

// ── Precision Slider ──────────────────────────────────────────────────────────

test.describe('Mixer Panel - Precision Slider', () => {
  test('precision slider is visible', async ({ page }) => {
    await expect(page.locator('#mixer-specificity-slider')).toBeVisible();
  });

  test('precision slider has correct range', async ({ page }) => {
    const slider = page.locator('#mixer-specificity-slider');
    await expect(slider).toHaveAttribute('min', '0');
    await expect(slider).toHaveAttribute('max', '100');
  });

  test('precision slider shows current value', async ({ page }) => {
    const valueBadge = page.locator('.mixer-value-badge');
    const text = await valueBadge.textContent();
    expect(text).toMatch(/\d+%/);
  });

  test('precision slider shows label (Broad/Focused/Narrow)', async ({ page }) => {
    const label = page.locator('.mixer-value-label');
    await expect(label).toBeVisible();
  });

  test('adjusting precision slider updates value display', async ({ page }) => {
    const slider = page.locator('#mixer-specificity-slider');
    await slider.fill('75');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(300);

    const valueBadge = page.locator('.mixer-value-badge');
    const text = await valueBadge.textContent();
    expect(text).toContain('75%');
  });
});

// ── Preset Chips ──────────────────────────────────────────────────────────────

test.describe('Mixer Panel - Preset Chips', () => {
  test('discovery preset chip is visible', async ({ page }) => {
    await expect(page.locator('[data-preset="discovery"]')).toBeVisible();
  });

  test('balanced preset chip is visible', async ({ page }) => {
    await expect(page.locator('[data-preset="balanced"]')).toBeVisible();
  });

  test('focus preset chip is visible', async ({ page }) => {
    await expect(page.locator('[data-preset="focus"]')).toBeVisible();
  });

  test('clicking preset chip applies configuration', async ({ page }) => {
    // Click discovery preset
    await page.click('[data-preset="discovery"]');
    await page.waitForTimeout(500);

    // Verify value updated
    const valueBadge = page.locator('.mixer-value-badge');
    const text = await valueBadge.textContent();
    expect(text).toContain('20%');
  });

  test('active preset chip has active class', async ({ page }) => {
    // Default should be balanced (50%)
    await expect(page.locator('[data-preset="balanced"]')).toHaveClass(/active/);
  });
});

// ── View Mode Buttons ─────────────────────────────────────────────────────────

test.describe('Mixer Panel - View Mode', () => {
  test('list view button is visible', async ({ page }) => {
    await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
  });

  test('space view button is visible', async ({ page }) => {
    await expect(page.locator('[data-view-mode="space"]')).toBeVisible();
  });

  test('grid view button is visible', async ({ page }) => {
    await expect(page.locator('[data-view-mode="grid"]')).toBeVisible();
  });

  test('active view mode has active class', async ({ page }) => {
    // Default should be list
    await expect(page.locator('[data-view-mode="list"]')).toHaveClass(/active/);
  });

  test('clicking view mode button changes active state', async ({ page }) => {
    await page.click('[data-view-mode="space"]');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-view-mode="space"]')).toHaveClass(/active/);
    await expect(page.locator('[data-view-mode="list"]')).not.toHaveClass(/active/);
  });

  test('view mode change updates feed container class', async ({ page }) => {
    await page.click('[data-view-mode="grid"]');
    await page.waitForTimeout(500);

    const feedContainer = page.locator('#now-feed');
    await expect(feedContainer).toHaveClass(/feed-view-grid/);
  });
});

// ── Expand/Collapse ───────────────────────────────────────────────────────────

test.describe('Mixer Panel - Progressive Disclosure', () => {
  test('panel starts collapsed', async ({ page }) => {
    const panel = page.locator('[data-testid="mixer-panel"]');
    expect(await panel.getAttribute('class')).not.toContain('mixer-panel-expanded');
  });

  test('expanded content is hidden when collapsed', async ({ page }) => {
    await expect(page.locator('.mixer-expanded-content')).not.toBeVisible();
  });

  test('clicking expand button shows expanded content', async ({ page }) => {
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);

    const panel = page.locator('[data-testid="mixer-panel"]');
    expect(await panel.getAttribute('class')).toContain('mixer-panel-expanded');
    await expect(page.locator('.mixer-expanded-content')).toBeVisible();
  });

  test('expanded content shows filters section', async ({ page }) => {
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);

    await expect(page.locator('.mixer-section-title-compact', { hasText: 'Filters' })).toBeVisible();
  });

  test('expanded content shows sort section', async ({ page }) => {
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);

    await expect(page.locator('.mixer-section-title-compact', { hasText: 'Sort' })).toBeVisible();
  });

  test('clicking collapse button hides expanded content', async ({ page }) => {
    // Expand first
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);

    // Collapse
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);

    const panel = page.locator('[data-testid="mixer-panel"]');
    expect(await panel.getAttribute('class')).not.toContain('mixer-panel-expanded');
    await expect(page.locator('.mixer-expanded-content')).not.toBeVisible();
  });
});

// ── Filters ───────────────────────────────────────────────────────────────────

test.describe('Mixer Panel - Filters', () => {
  test.beforeEach(async ({ page }) => {
    // Expand panel for filter tests
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);
  });

  test('Me filter chip is visible', async ({ page }) => {
    await expect(page.locator('[data-filter="showMe"]')).toBeVisible();
  });

  test('Others filter chip is visible', async ({ page }) => {
    await expect(page.locator('[data-filter="showOthers"]')).toBeVisible();
  });

  test('Trusted filter chip is visible', async ({ page }) => {
    await expect(page.locator('[data-filter="showTrusted"]')).toBeVisible();
  });

  test('High alignment filter chip is visible', async ({ page }) => {
    await expect(page.locator('[data-filter="showHighAlignment"]')).toBeVisible();
  });

  test('Low alignment filter chip is visible', async ({ page }) => {
    await expect(page.locator('[data-filter="showLowAlignment"]')).toBeVisible();
  });

  test('clicking filter chip toggles active state', async ({ page }) => {
    const filter = page.locator('[data-filter="showMe"]');
    const initialClass = await filter.getAttribute('class');
    const wasActive = initialClass?.includes('active');

    await filter.click();
    await page.waitForTimeout(200);

    const newClass = await filter.getAttribute('class');
    expect(newClass?.includes('active')).not.toBe(wasActive);
  });

  test('similarity slider is visible', async ({ page }) => {
    await expect(page.locator('#mixer-similarity-slider')).toBeVisible();
  });
});

// ── Sort ──────────────────────────────────────────────────────────────────────

test.describe('Mixer Panel - Sort', () => {
  test.beforeEach(async ({ page }) => {
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);
  });

  test('sort dropdown is visible', async ({ page }) => {
    await expect(page.locator('#mixer-sort-order')).toBeVisible();
  });

  test('sort dropdown has Recent option', async ({ page }) => {
    await expect(page.locator('#mixer-sort-order option[value="recency"]')).toBeVisible();
  });

  test('sort dropdown has Match option', async ({ page }) => {
    await expect(page.locator('#mixer-sort-order option[value="similarity"]')).toBeVisible();
  });

  test('sort dropdown has Active option', async ({ page }) => {
    await expect(page.locator('#mixer-sort-order option[value="activity"]')).toBeVisible();
  });

  test('changing sort order updates selection', async ({ page }) => {
    await page.selectOption('#mixer-sort-order', 'similarity');
    await page.waitForTimeout(200);

    const selected = await page.locator('#mixer-sort-order').inputValue();
    expect(selected).toBe('similarity');
  });
});

// ── Actions ───────────────────────────────────────────────────────────────────

test.describe('Mixer Panel - Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);
  });

  test('archive button is visible', async ({ page }) => {
    await expect(page.locator('#mixer-archive')).toBeVisible();
  });

  test('reset button is visible', async ({ page }) => {
    await expect(page.locator('#mixer-reset')).toBeVisible();
  });

  test('reset button has danger styling', async ({ page }) => {
    const resetBtn = page.locator('#mixer-reset');
    const className = await resetBtn.getAttribute('class');
    expect(className).toContain('btn-danger');
  });
});

// ── Compact Design ────────────────────────────────────────────────────────────

test.describe('Mixer Panel - Compact Design', () => {
  test('panel has compact styling', async ({ page }) => {
    const panel = page.locator('[data-testid="mixer-panel"]');
    const box = await panel.boundingBox();

    // Panel should be reasonably compact when collapsed
    expect(box?.height).toBeLessThan(200);
  });

  test('essential controls are always visible', async ({ page }) => {
    // Precision control
    await expect(page.locator('.mixer-precision-control')).toBeVisible();

    // View control
    await expect(page.locator('.mixer-view-control')).toBeVisible();
  });

  test('expand button shows correct icon when collapsed', async ({ page }) => {
    const expandBtn = page.locator('#mixer-expand');
    const text = await expandBtn.textContent();
    expect(text).toBe('▲');
  });

  test('expand button shows correct icon when expanded', async ({ page }) => {
    await page.click('#mixer-expand');
    await page.waitForTimeout(300);

    const expandBtn = page.locator('#mixer-expand');
    const text = await expandBtn.textContent();
    expect(text).toBe('▼');
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

test.describe('Mixer Panel - Accessibility', () => {
  test('mixer panel has data-testid attribute', async ({ page }) => {
    await expect(page.locator('[data-testid="mixer-panel"]')).toHaveCount(1);
  });

  test('buttons have aria labels or titles', async ({ page }) => {
    const buttons = page.locator('.mixer-icon-btn');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const title = await button.getAttribute('title');
      expect(title).toBeTruthy();
    }
  });

  test('sliders have accessible labels', async ({ page }) => {
    const precisionLabel = page.locator('.mixer-control-label', { hasText: 'Precision' });
    await expect(precisionLabel).toBeVisible();
  });
});
