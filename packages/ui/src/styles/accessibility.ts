/**
 * Accessibility Utilities
 *
 * WCAG 2.1 AA compliance helpers.
 */

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Calculate relative luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 0;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color contrast passes WCAG level
 */
export function checkContrast(
  fg: string,
  bg: string,
  level: 'AA' | 'AAA' = 'AA'
): { ratio: number; passes: boolean; minRatio: number } {
  const ratio = getContrastRatio(fg, bg);

  const minRatios: Record<string, number> = {
    'AA-normal': 4.5,
    'AA-large': 3,
    'AAA-normal': 7,
    'AAA-large': 4.5,
  };

  const minRatio = minRatios[`${level}-normal`];

  return {
    ratio,
    passes: ratio >= minRatio,
    minRatio,
  };
}

/**
 * ARIA role types
 */
export type AriaRole =
  | 'alert'
  | 'alertdialog'
  | 'application'
  | 'article'
  | 'banner'
  | 'button'
  | 'cell'
  | 'checkbox'
  | 'columnheader'
  | 'combobox'
  | 'complementary'
  | 'contentinfo'
  | 'definition'
  | 'dialog'
  | 'directory'
  | 'document'
  | 'feed'
  | 'figure'
  | 'form'
  | 'grid'
  | 'gridcell'
  | 'group'
  | 'heading'
  | 'img'
  | 'link'
  | 'list'
  | 'listbox'
  | 'listitem'
  | 'log'
  | 'main'
  | 'marquee'
  | 'math'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'navigation'
  | 'none'
  | 'note'
  | 'option'
  | 'presentation'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'region'
  | 'row'
  | 'rowgroup'
  | 'rowheader'
  | 'scrollbar'
  | 'search'
  | 'searchbox'
  | 'separator'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'switch'
  | 'tab'
  | 'table'
  | 'tablist'
  | 'tabpanel'
  | 'term'
  | 'textbox'
  | 'timer'
  | 'toolbar'
  | 'tooltip'
  | 'tree'
  | 'treegrid'
  | 'treeitem';

/**
 * ARIA attributes interface
 */
export interface AriaAttributes {
  role?: AriaRole;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: 'true' | 'false';
  'aria-busy'?: 'true' | 'false';
  'aria-checked'?: 'true' | 'false' | 'mixed';
  'aria-disabled'?: 'true' | 'false';
  'aria-expanded'?: 'true' | 'false';
  'aria-hidden'?: 'true' | 'false';
  'aria-invalid'?: 'true' | 'false' | 'grammar' | 'spelling';
  'aria-pressed'?: 'true' | 'false' | 'mixed';
  'aria-readonly'?: 'true' | 'false';
  'aria-required'?: 'true' | 'false';
  'aria-selected'?: 'true' | 'false';
  'aria-controls'?: string;
  'aria-current'?: 'true' | 'false' | 'page' | 'step' | 'location' | 'date' | 'time';
  'aria-haspopup'?: 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-owns'?: string;
  'aria-posinset'?: number;
  'aria-setsize'?: number;
  'aria-valuemax'?: number;
  'aria-valuemin'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
}

/**
 * Generate ARIA attributes object
 */
export function generateAria(attributes: AriaAttributes): AriaAttributes {
  return attributes;
}

/**
 * Screen reader announcement
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;

  let region = document.getElementById('aria-live-region');

  if (!region) {
    region = document.createElement('div');
    region.id = 'aria-live-region';
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(region);
  }

  // Clear and set message (forces announcement)
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/**
 * Keyboard navigation helper
 */
export interface KeyboardActions {
  [key: string]: () => void;
}

export function createKeyboardHandler(actions: KeyboardActions): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };
}

/**
 * Focus trap
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelectors);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstFocusable?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Focus restoration
 */
export function saveFocus(): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  return () => {
    previouslyFocused?.focus();
  };
}

/**
 * Skip link component props
 */
export interface SkipLinkProps {
  href: string;
  label?: string;
}

/**
 * Default skip links
 */
export const defaultSkipLinks: SkipLinkProps[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#search', label: 'Skip to search' },
];
