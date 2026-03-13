/**
 * Error Boundary Component
 * 
 * Catches and displays errors in child components with recovery options.
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
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
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
    window.location.reload();
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
        }}>
          <h2 style={{ color: '#d93025', margin: '0 0 16px 0', fontSize: '20px' }}>
            ⚠️ Something went wrong
          </h2>
          
          <div style={{ marginBottom: '16px' }}>
            <p style={{ margin: '0 0 8px 0', color: '#666' }}>
              {this.state.error.message}
            </p>
            
            {this.state.errorInfo?.componentStack && (
              <details style={{ fontSize: '12px', color: '#888' }}>
                <summary>Error details</summary>
                <pre style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
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
              }}
            >
              Try Again
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
              Reset App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
