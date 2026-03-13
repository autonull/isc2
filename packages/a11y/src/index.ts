/**
 * Accessibility Utilities
 *
 * WCAG 2.1 AA compliance utilities.
 */

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
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
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
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): { ratio: number; passes: boolean; minRatio: number; level: 'AA' | 'AAA' | 'fail' } {
  const ratio = getContrastRatio(fg, bg);

  const minRatios: Record<string, number> = {
    'AA-normal': 4.5,
    'AA-large': 3,
    'AAA-normal': 7,
    'AAA-large': 4.5,
  };

  const minRatio = minRatios[`${level}-${size}`];
  const passes = ratio >= minRatio;

  return {
    ratio,
    passes,
    minRatio,
    level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fail',
  };
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
 * Generate ARIA attributes object
 */
export function generateAria(attributes: AriaAttributes): AriaAttributes {
  return attributes;
}

/**
 * Skip link configuration
 */
export interface SkipLink {
  href: string;
  label: string;
}

/**
 * Default skip links
 */
export const defaultSkipLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#search', label: 'Skip to search' },
];

/**
 * Render skip links
 */
export function renderSkipLinks(links: SkipLink[] = defaultSkipLinks): void {
  if (typeof document === 'undefined') return;

  const container = document.getElementById('skip-links');
  if (container) return; // Already rendered

  const nav = document.createElement('nav');
  nav.id = 'skip-links';
  nav.className = 'isc-skip-links';
  nav.setAttribute('aria-label', 'Skip links');

  const ul = document.createElement('ul');
  ul.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 8px;
  `;

  links.forEach((link) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    a.style.cssText = `
      padding: 8px 16px;
      background: #000;
      color: #fff;
      text-decoration: none;
      border-radius: 4px;
    `;
    a.addEventListener('focus', () => {
      a.style.cssText = `
        padding: 8px 16px;
        background: #fff;
        color: #000;
        text-decoration: none;
        border-radius: 4px;
        outline: 2px solid #000;
        outline-offset: 2px;
      `;
    });
    a.addEventListener('blur', () => {
      a.style.cssText = `
        padding: 8px 16px;
        background: #000;
        color: #fff;
        text-decoration: none;
        border-radius: 4px;
      `;
    });
    li.appendChild(a);
    ul.appendChild(li);
  });

  nav.appendChild(ul);
  document.body.insertBefore(nav, document.body.firstChild);
}

/**
 * Roving tabindex manager
 */
export class RovingTabindex {
  private container: HTMLElement;
  private selector: string;
  private currentIndex: number = 0;

  constructor(container: HTMLElement, selector: string) {
    this.container = container;
    this.selector = selector;
    this.init();
  }

  private init(): void {
    this.container.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.updateTabindices();
  }

  private getItems(): HTMLElement[] {
    return Array.from(this.container.querySelectorAll<HTMLElement>(this.selector));
  }

  private updateTabindices(): void {
    const items = this.getItems();
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === this.currentIndex ? '0' : '-1');
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const items = this.getItems();
    if (items.length === 0) return;

    const { key } = event;
    let newIndex = this.currentIndex;

    if (key === 'ArrowDown' || key === 'ArrowRight') {
      newIndex = (this.currentIndex + 1) % items.length;
    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
      newIndex = (this.currentIndex - 1 + items.length) % items.length;
    } else if (key === 'Home') {
      newIndex = 0;
    } else if (key === 'End') {
      newIndex = items.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.currentIndex = newIndex;
    this.updateTabindices();
    items[this.currentIndex].focus();
  }

  destroy(): void {
    this.container.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }
}

/**
 * Visually hidden utility
 */
export const visuallyHidden: string = `
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

/**
 * Clear fix utility
 */
export const clearfix: string = `
  &::before,
  &::after {
    content: '';
    display: table;
    clear: both;
  }
`;
