import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#0a0a0f',
            color: '#e5e7eb',
            fontFamily: 'system-ui, sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
              color: '#f87171',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#9ca3af',
              marginBottom: '1.5rem',
              maxWidth: '480px',
            }}
          >
            The application encountered an unexpected error. You can try reloading
            the page or resetting the app state.
          </p>
          <pre
            style={{
              fontSize: '0.75rem',
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              padding: '1rem',
              maxWidth: '600px',
              maxHeight: '200px',
              overflow: 'auto',
              textAlign: 'left',
              color: '#fca5a5',
              marginBottom: '1.5rem',
              width: '100%',
            }}
          >
            {this.state.error?.message ?? 'Unknown error'}
            {this.state.error?.stack && (
              <>
                {'\n\n'}
                {this.state.error.stack}
              </>
            )}
          </pre>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.375rem',
                border: '1px solid #374151',
                background: '#1f2937',
                color: '#e5e7eb',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: '#3b82f6',
                color: '#ffffff',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
