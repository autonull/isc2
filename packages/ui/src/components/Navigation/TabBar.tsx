/**
 * TabBar Component
 *
 * Compound component pattern for tab navigation.
 * Headless - accepts active tab and callbacks as props.
 */

import type { JSX, ComponentChildren} from 'preact';
import { h, createContext } from 'preact';
import { useContext, useCallback } from 'preact/hooks';

interface TabBarContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  orientation: 'horizontal' | 'vertical';
}

const TabBarContext = createContext<TabBarContextValue | null>(null);

interface TabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: ComponentChildren;
  className?: string;
}

function TabBarRoot({
  activeTab,
  onTabChange,
  orientation = 'horizontal',
  position = 'top',
  children,
  className = '',
}: TabBarProps): JSX.Element {
  const setActiveTab = useCallback(
    (tabId: string) => {
      onTabChange(tabId);
    },
    [onTabChange]
  );

  return (
    <TabBarContext.Provider value={{ activeTab, setActiveTab, orientation }}>
      <nav
        class={`tab-bar tab-bar--${position} tab-bar--${orientation} ${className}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {children}
      </nav>
    </TabBarContext.Provider>
  );
}

interface TabProps {
  id: string;
  icon?: string;
  label?: string;
  badge?: number;
  children?: ComponentChildren;
  className?: string;
}

function Tab({ id, icon, label, badge, children, className = '' }: TabProps): JSX.Element {
  const context = useContext(TabBarContext);
  if (!context) {throw new Error('Tab must be used within TabBar');}

  const { activeTab, setActiveTab, orientation } = context;
  const isActive = activeTab === id;

  return (
    <button
      class={`tab ${isActive ? 'tab--active' : ''} tab--${orientation} ${className}`}
      onClick={() => setActiveTab(id)}
      aria-current={isActive ? 'page' : undefined}
      role="tab"
      aria-selected={isActive}
    >
      {icon && (
        <span class="tab__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {label && <span class="tab__label">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span class="tab__badge" aria-label={`${badge} notifications`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {children}
    </button>
  );
}

interface TabListProps {
  children: ComponentChildren;
  className?: string;
}

function TabList({ children, className = '' }: TabListProps): JSX.Element {
  return (
    <div class={`tab-list ${className}`} role="tablist">
      {children}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ComponentChildren;
  className?: string;
}

function TabPanel({ id, activeTab, children, className = '' }: TabPanelProps): JSX.Element | null {
  if (activeTab !== id) {return null;}

  return (
    <div class={`tab-panel ${className}`} role="tabpanel" aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

export const TabBar = Object.assign(TabBarRoot, {
  Tab,
  List: TabList,
  Panel: TabPanel,
});

export type { TabBarProps, TabProps, TabListProps, TabPanelProps };
