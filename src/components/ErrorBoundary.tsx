import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global ErrorBoundary component.
 * Catches unhandled exceptions and promise rejections anywhere in the React tree
 * and displays a fallback UI instead of crashing the entire application.
 * It also attempts to parse JSON-formatted errors (like those from firestoreErrorHandler)
 * to display more user-friendly messages.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (event.reason instanceof Error) {
      this.setState({ hasError: true, error: event.reason });
    } else {
      this.setState({ hasError: true, error: new Error(String(event.reason)) });
    }
  };

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      let errorMessage = "Si è verificato un errore imprevisto.";
      
      if (this.state.error?.message) {
        try {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.operationType) {
            errorMessage = `Errore di connessione al database (${parsedError.operationType}). Verifica i permessi o riprova più tardi.`;
          }
        } catch (e) {
          // Not a JSON error string
          errorMessage = this.state.error.message;
        }
      }

      return (
        <div className="min-h-viewport bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans text-zinc-50">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-100">Qualcosa è andato storto</h2>
                <p className="text-sm text-zinc-400 mt-1">L'applicazione ha riscontrato un errore imprevisto.</p>
              </div>
            </div>

            <div className="mb-8 p-4 bg-zinc-950 rounded-xl border border-zinc-800 overflow-auto max-h-64">
              <p className="text-red-400 font-mono text-sm mb-3 font-semibold">
                {errorMessage}
              </p>
              {this.state.errorInfo && (
                <pre className="text-zinc-500 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors"
              >
                Ricarica Pagina
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg font-medium transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Riprova
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
