import { h } from 'preact';
import { useNavigation } from '@isc/navigation';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { IRCSidebar } from './components/IRCSidebar.js';
import { NowScreen } from './screens/Now.js';
import { DiscoverScreen } from './screens/discover/DiscoverScreen.js';
import { VideoCallScreen } from './screens/VideoCalls.js';
import { ChatsScreen } from './screens/Chats.js';
import { SettingsScreen } from './screens/Settings.js';
import { ComposeScreen } from './screens/Compose.js';
import { useConnectionStatus } from './hooks/index.js';

type Route = 'now' | 'discover' | 'video' | 'chats' | 'settings' | 'compose';
type ConnectionStatus = 'online' | 'offline' | 'slow';

export function App() {
  const { currentRoute, navigate } = useNavigation();
  const route: Route = ((currentRoute?.name as Route) || 'now');
  const { status } = useConnectionStatus();
  const connectionStatus: ConnectionStatus = status as ConnectionStatus;

  console.log('[App] Current route:', route, 'connection:', connectionStatus);

  return (
    <ErrorBoundary>
      <div class="irc-layout">
        <IRCSidebar
          activeTab={route}
          onTabClick={(tabId) => {
            console.log('[App] Tab clicked:', tabId);
            navigate({ name: tabId, path: `/${tabId}` });
          }}
          badges={{}}
          channels={[]}
          connectionStatus={connectionStatus}
        />
        <main class="irc-main">
          <div class="app-content">
            {route === 'now' && <NowScreen />}
            {route === 'discover' && <DiscoverScreen />}
            {route === 'video' && <VideoCallScreen />}
            {route === 'chats' && <ChatsScreen />}
            {route === 'settings' && <SettingsScreen />}
            {route === 'compose' && <ComposeScreen />}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
