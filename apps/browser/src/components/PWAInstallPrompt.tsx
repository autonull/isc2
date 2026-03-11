/**
 * PWA Install Prompt Component
 * 
 * Shows install prompt when user can install the app.
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const styles = {
  container: {
    position: 'fixed' as const,
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #1da1f2, #0d8ddb)',
    color: 'white',
    padding: '16px 24px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    zIndex: 1000,
    maxWidth: '90%',
    width: '400px',
  },
  icon: {
    width: '40px',
    height: '40px',
    background: 'white',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    margin: '0 0 4px 0',
  },
  description: {
    fontSize: '13px',
    margin: '0',
    opacity: 0.9,
  },
  button: {
    background: 'white',
    color: '#1da1f2',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  closeButton: {
    background: 'transparent',
    color: 'white',
    border: 'none',
    padding: '8px',
    cursor: 'pointer',
    opacity: 0.8,
    fontSize: '20px',
    lineHeight: 1,
  },
};

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // Don't show immediately - wait a bit for better UX
      setTimeout(() => {
        // Check if user has dismissed before
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        const dismissedAt = dismissed ? parseInt(dismissed, 10) : 0;
        const daysSinceDismissal = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        
        // Only show if not dismissed in the last 7 days
        if (daysSinceDismissal > 7) {
          setVisible(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
    } catch (err) {
      console.error('[PWA] Install prompt error:', err);
    } finally {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!visible || !deferredPrompt) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.icon}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1da1f2" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div style={styles.content}>
        <p style={styles.title}>Install ISC</p>
        <p style={styles.description}>Add to home screen for quick access</p>
      </div>
      <button style={styles.button} onClick={handleInstall}>
        Install
      </button>
      <button style={styles.closeButton} onClick={handleClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
