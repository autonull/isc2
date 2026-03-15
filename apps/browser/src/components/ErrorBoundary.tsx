/**
 * Error Boundary Component
 * 
 * Catches React rendering errors and displays fallback UI.
 * Prevents entire app from crashing on component errors.
 */

import { h, Component } from 'preact';
import { useState } from 'preact/hooks';

interface ErrorBoundaryProps {
  children: any;
  fallback?: any;
  onError?: (error: Error, errorInfo: any) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const styles = {
  container: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    maxWidth: '500px',
    margin: '0 auto',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: '#14171a',
    marginBottom: '16px',
  },
  message: {
    fontSize: '16px',
    color: '#657786',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  button: {
    padding: '12px 24px',
    background: '#1da1f2',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
    fontSize: '14px',
    marginRight: '12px',
  },
  secondaryButton: {
    padding: '12px 24px',
    background: '#e8f4fd',
    color: '#1da1f2',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
    fontSize: '14px',
  },
  details: {
    marginTop: '24px',
    padding: '16px',
    background: '#f7f9fa',
    borderRadius: '8px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#657786',
    overflow: 'auto' as const,
    maxHeight: '200px',
  },
};

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): any {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div style={styles.container} role="alert">
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>
            We're sorry, but there was an error loading this content.
            Please try again or reload the page.
          </p>
          <div>
            <button 
              style={styles.button}
              onClick={this.handleRetry}
            >
              🔄 Try Again
            </button>
            <button 
              style={styles.secondaryButton}
              onClick={this.handleReload}
            >
              🔄 Reload Page
            </button>
          </div>
          {error && (
            <details style={styles.details}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
                Error Details
              </summary>
              <pre>{error.toString()}</pre>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook-based Error Boundary for functional components
 */
export function useErrorHandler(): [(error: Error) => void, Error | null] {
  const [error, setError] = useState<Error | null>(null);

  const handleError = (err: Error): void => {
    console.error('[useErrorHandler] Error:', err);
    setError(err);
  };

  return [handleError, error];
}

/**
 * Higher Order Component for error handling
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: preact.FunctionalComponent<P>,
  fallback?: any
): preact.FunctionalComponent<P> {
  return (props: P) => (
    <ErrorBoundaryClass fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundaryClass>
  );
}

export const ErrorBoundary = ErrorBoundaryClass;
export default ErrorBoundaryClass;
