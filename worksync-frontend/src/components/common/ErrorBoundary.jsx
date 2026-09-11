import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log non-sensitive information for diagnostics
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary caught error]', error?.message, errorInfo?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 m-4">
          <div className="max-w-md text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Something went wrong</h2>
            <p className="text-sm text-slate-400">
              An unexpected error occurred while rendering this interface. You can try refreshing the view.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload View
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
