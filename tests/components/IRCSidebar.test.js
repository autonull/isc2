/**
 * IRCSidebar Component Tests
 *
 * Tests the sidebar navigation component in isolation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { createTestContainer, cleanup } from './test-utils';
// Import component dynamically for testing
async function importComponent() {
    return import('../../apps/browser/src/components/IRCSidebar');
}
describe('IRCSidebar', () => {
    let container;
    beforeEach(() => {
        container = createTestContainer();
    });
    afterEach(() => {
        cleanup(container);
    });
    it('renders all navigation tabs', async () => {
        const { IRCSidebar } = await importComponent();
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: {},
            channels: [],
        }), container);
        // Check for tab elements
        const tabs = container.querySelectorAll('[data-testid^="nav-tab-"]');
        expect(tabs.length).toBeGreaterThanOrEqual(4); // At least main tabs
        // Check for specific tabs
        const nowTab = container.querySelector('[data-testid="nav-tab-now"]');
        const chatsTab = container.querySelector('[data-testid="nav-tab-chats"]');
        const settingsTab = container.querySelector('[data-testid="nav-tab-settings"]');
        const composeTab = container.querySelector('[data-testid="nav-tab-compose"]');
        expect(nowTab).toBeTruthy();
        expect(chatsTab).toBeTruthy();
        expect(settingsTab).toBeTruthy();
        expect(composeTab).toBeTruthy();
    });
    it('shows active state on selected tab', async () => {
        const { IRCSidebar } = await importComponent();
        render(h(IRCSidebar, {
            activeTab: 'discover',
            onTabClick: () => { },
            badges: {},
            channels: [],
        }), container);
        const discoverTab = container.querySelector('[data-testid="nav-tab-discover"]');
        expect(discoverTab).toBeTruthy();
        expect(discoverTab?.getAttribute('data-active')).toBe('true');
        // Now tab should not be active
        const nowTab = container.querySelector('[data-testid="nav-tab-now"]');
        expect(nowTab?.getAttribute('data-active')).not.toBe('true');
    });
    it('displays badge counts', async () => {
        const { IRCSidebar } = await importComponent();
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: { now: 5, chats: 10 },
            channels: [],
        }), container);
        const nowBadge = container.querySelector('[data-testid="nav-tab-now-badge"]');
        const chatsBadge = container.querySelector('[data-testid="nav-tab-chats-badge"]');
        expect(nowBadge).toBeTruthy();
        expect(nowBadge?.textContent).toBe('5');
        expect(chatsBadge).toBeTruthy();
        expect(chatsBadge?.textContent).toBe('10');
    });
    it('hides badges when count is zero', async () => {
        const { IRCSidebar } = await importComponent();
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: { now: 0, chats: 0 },
            channels: [],
        }), container);
        const nowBadge = container.querySelector('[data-testid="nav-tab-now-badge"]');
        const chatsBadge = container.querySelector('[data-testid="nav-tab-chats-badge"]');
        expect(nowBadge).toBeFalsy();
        expect(chatsBadge).toBeFalsy();
    });
    it('renders channel list', async () => {
        const { IRCSidebar } = await importComponent();
        const channels = [
            { id: '1', name: 'AI Ethics', description: 'Discussion about AI' },
            { id: '2', name: 'Tech News', description: 'Latest tech updates' },
        ];
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: {},
            channels,
        }), container);
        // Check for channel items with specific data-channel-id
        const channel1 = container.querySelector('[data-channel-id="1"]');
        const channel2 = container.querySelector('[data-channel-id="2"]');
        expect(channel1).toBeTruthy();
        expect(channel2).toBeTruthy();
        // Check channel names
        const channel1Name = container.querySelector('[data-testid="sidebar-channel-1-name"]');
        const channel2Name = container.querySelector('[data-testid="sidebar-channel-2-name"]');
        expect(channel1Name?.textContent).toContain('AI Ethics');
        expect(channel2Name?.textContent).toContain('Tech News');
    });
    it('shows empty state when no channels', async () => {
        const { IRCSidebar } = await importComponent();
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: {},
            channels: [],
        }), container);
        const emptyState = container.querySelector('[data-testid="sidebar-no-channels"]');
        expect(emptyState).toBeTruthy();
        expect(emptyState?.textContent).toContain('No channels');
    });
    it('highlights active channel', async () => {
        const { IRCSidebar } = await importComponent();
        const channels = [
            { id: '1', name: 'AI Ethics', description: 'Discussion about AI' },
            { id: '2', name: 'Tech News', description: 'Latest tech updates' },
        ];
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: {},
            channels,
            activeChannelId: '2',
        }), container);
        const channel1 = container.querySelector('[data-testid="sidebar-channel-1"]');
        const channel2 = container.querySelector('[data-testid="sidebar-channel-2"]');
        expect(channel1?.getAttribute('data-active')).not.toBe('true');
        expect(channel2?.getAttribute('data-active')).toBe('true');
    });
    it('calls onTabClick when tab is clicked', async () => {
        const { IRCSidebar } = await importComponent();
        const onTabClick = vi.fn();
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick,
            badges: {},
            channels: [],
        }), container);
        const discoverTab = container.querySelector('[data-testid="nav-tab-discover"]');
        discoverTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onTabClick).toHaveBeenCalledWith('discover');
    });
    it('calls onChannelSelect when channel is clicked', async () => {
        const { IRCSidebar } = await importComponent();
        const onChannelSelect = vi.fn();
        const channels = [
            { id: '1', name: 'AI Ethics', description: 'Discussion about AI' },
        ];
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: {},
            channels,
            onChannelSelect,
        }), container);
        const channel = container.querySelector('[data-testid="sidebar-channel-1"]');
        channel?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onChannelSelect).toHaveBeenCalledWith('1');
    });
    it('has proper accessibility attributes', async () => {
        const { IRCSidebar } = await importComponent();
        render(h(IRCSidebar, {
            activeTab: 'now',
            onTabClick: () => { },
            badges: {},
            channels: [],
        }), container);
        // Check for aria-current on active tab
        const activeTab = container.querySelector('[aria-current="page"]');
        expect(activeTab).toBeTruthy();
        // Check sidebar has role
        const sidebar = container.querySelector('[data-testid="sidebar"]');
        expect(sidebar).toBeTruthy();
    });
});
//# sourceMappingURL=IRCSidebar.test.js.map