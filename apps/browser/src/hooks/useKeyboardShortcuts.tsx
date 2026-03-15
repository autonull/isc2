/**
 * Keyboard Shortcuts Hook
 * 
 * Provides global keyboard shortcuts for the Web UI.
 * Improves power user experience and accessibility.
 */

import { useEffect } from 'preact/hooks';
import { useNavigation } from '@isc/navigation';

export interface ShortcutConfig {
  key: string;
  handler: () => void;
  description: string;
  category: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  preventDefault?: boolean;
}

/**
 * Register global keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const { key, ctrlKey, shiftKey, altKey, metaKey } = event;

      for (const shortcut of shortcuts) {
        const matches =
          key.toLowerCase() === shortcut.key.toLowerCase() &&
          (shortcut.ctrl === undefined || ctrlKey === shortcut.ctrl) &&
          (shortcut.shift === undefined || shiftKey === shortcut.shift) &&
          (shortcut.alt === undefined || altKey === shortcut.alt) &&
          (shortcut.meta === undefined || metaKey === shortcut.meta);

        if (matches) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * Default application shortcuts
 */
export function useDefaultShortcuts(): void {
  const { navigate } = useNavigation();

  const shortcuts: ShortcutConfig[] = [
    // Navigation
    {
      key: '1',
      handler: () => navigate({ name: 'now', path: '/now' }),
      description: 'Go to Now (Feed)',
      category: 'Navigation',
    },
    {
      key: '2',
      handler: () => navigate({ name: 'discover', path: '/discover' }),
      description: 'Go to Discover',
      category: 'Navigation',
    },
    {
      key: '3',
      handler: () => navigate({ name: 'compose', path: '/compose' }),
      description: 'Go to Compose',
      category: 'Navigation',
    },
    {
      key: '4',
      handler: () => navigate({ name: 'chats', path: '/chats' }),
      description: 'Go to Chats',
      category: 'Navigation',
    },
    {
      key: '5',
      handler: () => navigate({ name: 'settings', path: '/settings' }),
      description: 'Go to Settings',
      category: 'Navigation',
    },
    {
      key: 'n',
      handler: () => navigate({ name: 'compose', path: '/compose' }),
      description: 'New Channel',
      category: 'Actions',
    },
    {
      key: 'c',
      handler: () => {
        // Focus compose input if on Now screen
        const input = document.querySelector('textarea[data-testid="compose-input"]') as HTMLTextAreaElement;
        input?.focus();
      },
      description: 'Compose Post',
      category: 'Actions',
    },
    {
      key: 'd',
      handler: () => navigate({ name: 'discover', path: '/discover' }),
      description: 'Discover Peers',
      category: 'Actions',
    },
    {
      key: 'r',
      handler: () => window.location.reload(),
      description: 'Refresh Page',
      category: 'Actions',
      ctrl: true,
    },
    {
      key: '/',
      handler: () => {
        // Focus search (future feature)
        const search = document.querySelector('input[type="search"]') as HTMLInputElement;
        search?.focus();
      },
      description: 'Search',
      category: 'Actions',
    },
    {
      key: '?',
      handler: () => {
        // Show keyboard help (future feature)
        console.log('Keyboard shortcuts help');
      },
      description: 'Show Help',
      category: 'Help',
    },
    {
      key: 'Escape',
      handler: () => {
        // Close modals, blur inputs
        (document.activeElement as HTMLElement)?.blur();
      },
      description: 'Close/Cancel',
      category: 'General',
    },
  ];

  useKeyboardShortcuts(shortcuts);
}

/**
 * Keyboard Help Modal Component
 */
export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  const shortcuts: ShortcutConfig[] = [
    { key: '1', handler: () => {}, description: 'Go to Now', category: 'Navigation' },
    { key: '2', handler: () => {}, description: 'Go to Discover', category: 'Navigation' },
    { key: '3', handler: () => {}, description: 'Go to Compose', category: 'Navigation' },
    { key: '4', handler: () => {}, description: 'Go to Chats', category: 'Navigation' },
    { key: '5', handler: () => {}, description: 'Go to Settings', category: 'Navigation' },
    { key: 'n', handler: () => {}, description: 'New Channel', category: 'Actions' },
    { key: 'c', handler: () => {}, description: 'Compose Post', category: 'Actions' },
    { key: 'd', handler: () => {}, description: 'Discover Peers', category: 'Actions' },
    { key: 'r', handler: () => {}, description: 'Refresh (Ctrl+R)', category: 'Actions', ctrl: true },
    { key: '/', handler: () => {}, description: 'Search', category: 'Actions' },
    { key: '?', handler: () => {}, description: 'Show Help', category: 'Help' },
    { key: 'Escape', handler: () => {}, description: 'Close/Cancel', category: 'General' },
  ];

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001,
    },
    modal: {
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '80vh',
      overflow: 'auto' as const,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
    },
    title: {
      fontSize: '20px',
      fontWeight: 'bold' as const,
      margin: 0,
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#657786',
    },
    category: {
      marginBottom: '20px',
    },
    categoryTitle: {
      fontSize: '14px',
      fontWeight: 'bold' as const,
      color: '#657786',
      marginBottom: '12px',
      textTransform: 'uppercase' as const,
    },
    shortcut: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #f0f0f0',
    },
    shortcutDescription: {
      fontSize: '14px',
      color: '#14171a',
    },
    shortcutKeys: {
      display: 'flex',
      gap: '4px',
    },
    key: {
      padding: '4px 8px',
      background: '#f0f0f0',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#657786',
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>⌨️ Keyboard Shortcuts</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {categories.map(category => (
          <div key={category} style={styles.category}>
            <div style={styles.categoryTitle}>{category}</div>
            {shortcuts
              .filter(s => s.category === category)
              .map((shortcut, i) => (
                <div key={i} style={styles.shortcut}>
                  <span style={styles.shortcutDescription}>{shortcut.description}</span>
                  <div style={styles.shortcutKeys}>
                    {shortcut.ctrl && <span style={styles.key}>Ctrl</span>}
                    {shortcut.shift && <span style={styles.key}>Shift</span>}
                    {shortcut.alt && <span style={styles.key}>Alt</span>}
                    <span style={styles.key}>{shortcut.key.toUpperCase()}</span>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
