/**
 * Splash Screen Component
 * 
 * Initial loading screen shown during app initialization.
 * Provides visual feedback while network and identity load.
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface SplashProps {
  loading: boolean;
  status: string;
  progress?: number;
  error?: string | null;
  onRetry?: () => void;
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    color: 'white',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  logo: {
    fontSize: '64px',
    marginBottom: '24px',
    animation: 'pulse 2s ease-in-out infinite',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold' as const,
    marginBottom: '8px',
    background: 'linear-gradient(90deg, #00d9ff, #00ff88)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '16px',
    color: '#8892b0',
    marginBottom: '48px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(255,255,255,0.1)',
    borderTop: '4px solid #00d9ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '24px',
  },
  status: {
    fontSize: '14px',
    color: '#8892b0',
    marginBottom: '16px',
  },
  progress: {
    width: '200px',
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #00d9ff, #00ff88)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  error: {
    background: 'rgba(224, 36, 94, 0.2)',
    border: '1px solid #e0245e',
    borderRadius: '8px',
    padding: '16px 24px',
    marginTop: '24px',
    textAlign: 'center' as const,
  },
  errorTitle: {
    color: '#e0245e',
    fontWeight: 'bold' as const,
    marginBottom: '8px',
  },
  errorMessage: {
    color: '#ff6b8a',
    fontSize: '14px',
    marginBottom: '16px',
  },
  retryButton: {
    padding: '10px 24px',
    background: 'linear-gradient(90deg, #00d9ff, #00ff88)',
    border: 'none',
    borderRadius: '20px',
    color: '#1a1a2e',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    fontSize: '14px',
  },
  features: {
    display: 'flex',
    gap: '32px',
    marginTop: '48px',
  },
  feature: {
    textAlign: 'center' as const,
  },
  featureIcon: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  featureText: {
    fontSize: '12px',
    color: '#8892b0',
  },
};

export function SplashScreen({ loading, status, progress = 0, error, onRetry }: SplashProps) {
  const [dots, setDots] = useState('');

  // Animate loading dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  if (!loading && !error) {
    return null;
  }

  return (
    <div style={styles.container} role="alert" aria-live="polite">
      {/* Logo */}
      <div style={styles.logo}>🌐</div>
      
      {/* Title */}
      <h1 style={styles.title}>ISC</h1>
      <p style={styles.subtitle}>Internet Semantic Connect</p>

      {/* Loading State */}
      {loading && !error && (
        <>
          <div style={styles.spinner} aria-hidden="true" />
          <div style={styles.status}>
            {status}{dots}
          </div>
          
          {/* Progress Bar */}
          {progress > 0 && (
            <div style={styles.progress}>
              <div 
                style={{ 
                  ...styles.progressBar, 
                  width: `${Math.min(100, progress)}%` 
                }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          )}

          {/* Features Preview */}
          <div style={styles.features} aria-hidden="true">
            <div style={styles.feature}>
              <div style={styles.featureIcon}>📡</div>
              <div style={styles.featureText}>Discover</div>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>💬</div>
              <div style={styles.featureText}>Connect</div>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>🔐</div>
              <div style={styles.featureText}>Secure</div>
            </div>
          </div>
        </>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          <div style={styles.errorTitle}>⚠️ Loading Failed</div>
          <div style={styles.errorMessage}>{error}</div>
          {onRetry && (
            <button 
              style={styles.retryButton}
              onClick={onRetry}
              aria-label="Retry loading"
            >
              🔄 Try Again
            </button>
          )}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
