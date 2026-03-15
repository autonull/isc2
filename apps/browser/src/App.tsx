import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useNavigation } from '@isc/navigation';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { SplashScreen } from './components/SplashScreen.js';
import { Onboarding } from './components/Onboarding.js';
import { useDefaultShortcuts, KeyboardHelp } from './hooks/useKeyboardShortcuts.js';
import { IRCSidebar } from './components/IRCSidebar.js';
import { NowScreen } from './screens/Now.js';
import { DiscoverScreen } from './screens/discover/DiscoverScreen.js';
import { VideoCallScreen } from './screens/VideoCalls.js';
import { ChatsScreen } from './screens/Chats.js';
import { SettingsScreen } from './screens/Settings.js';
import { ComposeScreen } from './screens/Compose.js';
import { useConnectionStatus } from './hooks/index.js';
import { useDependencies } from './di/container.js';

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
  const [showOnboarding, setShowOnboarding] = useState(false);

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

        // Network service is optional - app works without it
        if (networkService) {
          try {
            setInitStatus('Connecting to network');
            setInitProgress(40);

            await networkService.initialize();
            setInitProgress(80);

            setInitStatus('Ready');
            setInitProgress(100);
          } catch (networkErr) {
            console.warn('[App] Network initialization failed, continuing without network:', networkErr);
            setInitStatus('Offline mode');
            setInitProgress(100);
          }
        } else {
          console.log('[App] No network service available, running in offline mode');
          setInitStatus('Offline mode');
          setInitProgress(100);
        }

        // Small delay for smooth UX
        setTimeout(() => {
          // Check if user needs onboarding
          const completed = localStorage.getItem('isc-onboarding-completed');
          if (!completed) {
            setShowOnboarding(true);
          }
          setLoading(false);
        }, 300);
      } catch (err) {
        console.error('[App] Initialization failed:', err);
        setInitError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    }

    initialize();
  }, []); // Empty deps - don't depend on networkService

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

      {/* Onboarding Flow */}
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}

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
