import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// Única clase del proyecto: React no ofrece error boundaries como función.
// No muestra stack traces al usuario; el detalle solo va a consola en desarrollo.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="auth-screen">
        <div className="auth-card" role="alert">
          <h1 className="auth-card__title">Algo ha fallado</h1>
          <p className="auth-card__subtitle">Recarga la página. Si se repite, avisa al equipo.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
