/**
 * Error Boundary Component
 *
 * Catches and handles errors in child components.
 */

import type { JSX, ComponentChild } from 'preact';
import { h, Component } from 'preact';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack?: string } | null;
}

export interface ErrorBoundaryProps {
  children: ComponentChild;
  fallback?: (error: Error, reset: () => void) => JSX.Element;
  onError?: (error: Error, errorInfo: { componentStack?: string }) => void;
  resetOnPropsChange?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.props.resetOnPropsChange && prevProps.children !== this.props.children) {
      this.reset();
    }
  }

  render(): JSX.Element {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div class="error-boundary" role="alert" aria-live="assertive">
          <div class="error-boundary__content">
            <h2 class="error-boundary__title">Something went wrong</h2>
            <p class="error-boundary__message">
              {this.state.error.message || 'An unexpected error occurred'}
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
              <details class="error-boundary__details">
                <summary>Error details</summary>
                <pre class="error-boundary__stack">{this.state.error.stack}</pre>
                {this.state.errorInfo.componentStack && (
                  <pre class="error-boundary__component-stack">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
            <button class="error-boundary__retry" onClick={this.reset} type="button">
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children as JSX.Element;
  }
}

export interface AsyncErrorBoundaryProps extends Omit<ErrorBoundaryProps, 'fallback'> {
  fallback?: (error: Error, reset: () => void) => JSX.Element;
  loading?: JSX.Element;
}

interface AsyncErrorBoundaryState extends ErrorBoundaryState {
  isLoading: boolean;
}

export class AsyncErrorBoundary extends Component<
  AsyncErrorBoundaryProps,
  AsyncErrorBoundaryState
> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isLoading: false };
  }

  static getDerivedStateFromError(error: Error): Partial<AsyncErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }): void {
    this.setState({ errorInfo, isLoading: false });
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, isLoading: false });
  };

  setLoading = (isLoading: boolean): void => {
    this.setState({ isLoading });
  };

  render(): JSX.Element {
    if (this.state.isLoading && this.props.loading) {
      return this.props.loading;
    }

    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div class="error-boundary" role="alert" aria-live="assertive">
          <div class="error-boundary__content">
            <h2 class="error-boundary__title">Something went wrong</h2>
            <p class="error-boundary__message">{this.state.error.message}</p>
            <button class="error-boundary__retry" onClick={this.reset} type="button">
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children as JSX.Element;
  }
}

export function withErrorBoundary<P extends Record<string, unknown>>(
  Component: preact.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): (props: P) => JSX.Element {
  return function WrappedWithErrorBoundary(props: P): JSX.Element {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
