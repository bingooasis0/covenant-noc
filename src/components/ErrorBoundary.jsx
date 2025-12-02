import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#f3f4f6',
          padding: '40px'
        }}>
          <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: '24px' }} />
          <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Something went wrong</h1>
          <p style={{ fontSize: '16px', color: '#9ca3af', marginBottom: '24px', maxWidth: '600px', textAlign: 'center' }}>
            The application encountered an error. Please refresh the page or contact support if the problem persists.
          </p>
          <details style={{ 
            background: '#1a1a1a', 
            padding: '20px', 
            borderRadius: '8px', 
            maxWidth: '800px', 
            width: '100%',
            border: '1px solid #333'
          }}>
            <summary style={{ cursor: 'pointer', marginBottom: '12px', fontWeight: 600 }}>
              Error Details
            </summary>
            <pre style={{ 
              overflow: 'auto', 
              fontSize: '12px', 
              color: '#ef4444',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {this.state.error && this.state.error.toString()}
              {'\n\n'}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

