/**
 * Error Boundary Component
 *
 * Catches and displays errors in child components with recovery options.
 * Includes detailed logging for debugging.
 */

import { h, Component } from 'preact';
import type { ComponentChildren } from 'preact';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack?: string } | null;
}

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: (error: Error, retry: () => void) => ComponentChildren;
  onError?: (error: Error, errorInfo: any) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    this.setState({ errorInfo });
    
    // Comprehensive error logging for debugging
    const errorReport = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo?.componentStack,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      online: navigator.onLine,
      language: navigator.language,
    };

    console.error('[ErrorBoundary] Caught error:', errorReport);

    // Store error in sessionStorage for debugging
    try {
      const errors = JSON.parse(sessionStorage.getItem('isc-errors') || '[]');
      errors.push(errorReport);
      sessionStorage.setItem('isc-errors', JSON.stringify(errors.slice(-10))); // Keep last 10
    } catch (e) {
      // Ignore storage errors
    }

    // Log to error reporting service (if configured)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReset = (): void => {
    // Clear all cached state and reload
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  handleDownloadErrorReport = (): void => {
    const errors = sessionStorage.getItem('isc-errors');
    if (!errors) return;

    const blob = new Blob([errors], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isc-error-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  render(): ComponentChildren {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <div style={{
          padding: '24px',
          maxWidth: '600px',
          margin: '48px auto',
          background: '#fef3f2',
          border: '1px solid #fda29b',
          borderRadius: '8px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h2 style={{ color: '#d93025', margin: '0 0 16px 0', fontSize: '20px' }}>
            ⚠️ Something went wrong
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <p style={{ margin: '0 0 8px 0', color: '#666', fontWeight: 500 }}>
              {this.state.error.message}
            </p>
            
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#999' }}>
              Error: {this.state.error.name} at {new Date().toLocaleTimeString()}
            </p>

            {this.state.errorInfo?.componentStack && (
              <details style={{ fontSize: '12px', color: '#888' }}>
                <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Component stack trace</summary>
                <pre style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            {this.state.error.stack && (
              <details style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Full stack trace</summary>
                <pre style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '300px',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '10px 20px',
                background: '#1a73e8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              🔄 Try Again
            </button>

            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              🔄 Reset App
            </button>

            <button
              onClick={this.handleDownloadErrorReport}
              style={{
                padding: '10px 20px',
                background: '#fff',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              📥 Download Error Report
            </button>
          </div>
          
          <p style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
            💡 Tip: Download the error report and share it with developers for debugging.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
