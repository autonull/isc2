import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useNavigation } from '@isc/navigation';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { SplashScreen } from './components/SplashScreen.js';
import { useDefaultShortcuts, KeyboardHelp } from './hooks/useKeyboardShortcuts.tsx';
import { IRCSidebar } from './components/IRCSidebar.js';
import { NowScreen } from './screens/Now.js';
import { DiscoverScreen } from './screens/discover/DiscoverScreen.js';
import { VideoCallScreen } from './screens/VideoCalls.js';
import { ChatsScreen } from './screens/Chats.js';
import { SettingsScreen } from './screens/Settings.js';
import { ComposeScreen } from './screens/Compose.js';
import { useConnectionStatus } from './hooks/index.js';
import { useDependencies } from './di/container.jsx';

type Route = 'now' | 'discover' | 'video' | 'chats' | 'settings' | 'compose';
type ConnectionStatus = 'online' | 'offline' | 'slow';

export function App() {
  const { currentRoute, navigate } = useNavigation();
  const { networkService } = useDependencies();
  const route: Route = ((currentRoute?.name as Route) || 'now');
  const { status } = useConnectionStatus();
  const connectionStatus: ConnectionStatus = status as ConnectionStatus;
  
  const [loading, setLoading] = useState(true);
  const [initStatus, setInitStatus] = useState('Initializing');
  const [initProgress, setInitProgress] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Enable keyboard shortcuts
  useDefaultShortcuts();

  // Handle keyboard help toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowKeyboardHelp(prev => !prev);
      }
      if (e.key === 'Escape' && showKeyboardHelp) {
        setShowKeyboardHelp(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showKeyboardHelp]);

  // Initialize network service with progress tracking
  useEffect(() => {
    async function initialize() {
      try {
        setInitStatus('Loading identity');
        setInitProgress(20);
        
        if (networkService) {
          setInitStatus('Connecting to network');
          setInitProgress(40);
          
          await networkService.initialize();
          setInitProgress(80);
          
          setInitStatus('Ready');
          setInitProgress(100);
        }
        
        setTimeout(() => setLoading(false), 500);
      } catch (err) {
        console.error('[App] Initialization failed:', err);
        setInitError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    }
    
    initialize();
  }, [networkService]);

  const handleRetry = async () => {
    setLoading(true);
    setInitError(null);
    setInitProgress(0);
    
    try {
      if (networkService) {
        await networkService.initialize();
      }
      setTimeout(() => setLoading(false), 500);
    } catch (err) {
      setInitError(err instanceof Error ? err.message : 'Failed to initialize');
    }
  };

  console.log('[App] Current route:', route, 'connection:', connectionStatus);

  return (
    <>
      {/* Splash Screen */}
      <SplashScreen
        loading={loading}
        status={initStatus}
        progress={initProgress}
        error={initError}
        onRetry={handleRetry}
      />

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />}

      {/* Main App (only show when not loading) */}
      {!loading && (
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
      )}
    </>
  );
}
