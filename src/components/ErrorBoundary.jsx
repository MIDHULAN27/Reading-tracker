import React, { Component } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('Cozy Reads ErrorBoundary caught an uncaught exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      // Clear non-critical local cache keys that might have corrupted states, leaving auth intact
      const itemsToKeep = ['cozy_reads_session', 'cozy_reads_user'];
      const kept = {};
      itemsToKeep.forEach(k => {
        const v = localStorage.getItem(k);
        if (v) kept[k] = v;
      });
      
      localStorage.clear();
      
      // Restore auth
      Object.entries(kept).forEach(([k, v]) => {
        localStorage.setItem(k, v);
      });
    } catch (e) {
      console.error(e);
    }
    
    // Force direct reload to landing route
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.local) {
        return (
          <div className="w-full p-6 glass-panel border border-white/20 dark:border-white/10 rounded-3xl shadow-xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4 border border-red-500/20">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-serif font-bold text-lg text-cozy-night-300 dark:text-white leading-snug">
              Could not load page content
            </h3>
            <p className="text-xs text-cozy-night-100/60 dark:text-cozy-cream-200/40 mt-2 max-w-sm">
              An error occurred rendering this section. The rest of the sidebar and app navigation is fully functional.
            </p>
            <div className="w-full mt-4 p-3 rounded-lg bg-black/10 dark:bg-black/25 text-left border border-white/5 font-mono text-[9px] text-cozy-night-100/70 dark:text-cozy-cream-200/45 max-h-24 overflow-y-auto custom-scrollbar select-text">
              <span className="text-red-400 font-bold">Error:</span> {this.state.error?.message || 'Unknown exception'}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="mt-4 py-2 px-4 rounded-xl bg-gradient-to-tr from-cozy-amber to-cozy-amber-dark text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cozy-amber/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Page</span>
            </button>
          </div>
        );
      }
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cozy-cream-100 dark:bg-cozy-night-300 transition-colors duration-300">
          {/* Subtle colored backdrop glow circles */}
          <div className="absolute top-1/4 left-1/4 w-[280px] h-[280px] rounded-full bg-red-500/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[280px] h-[280px] rounded-full bg-cozy-amber/5 blur-3xl pointer-events-none" />

          <div className="glass-panel max-w-md w-full p-8 border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Warning Shield Alert icon */}
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-6 shadow-sm border border-red-500/20">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <h2 className="font-serif font-bold text-2xl text-cozy-night-300 dark:text-white leading-snug tracking-tight">
              A slight reading hiccup
            </h2>
            <p className="text-xs text-cozy-night-100/60 dark:text-cozy-cream-200/40 mt-3 max-w-sm leading-relaxed">
              Booklyn encountered an unexpected rendering error. Your library data is fully secure in your database and local shelf synchronizers.
            </p>

            {/* Micro Debug Console */}
            <div className="w-full mt-6 p-4 rounded-xl bg-black/10 dark:bg-black/25 text-left border border-white/5 font-mono text-[10px] text-cozy-night-100/70 dark:text-cozy-cream-200/45 overflow-x-auto select-text max-h-24 custom-scrollbar">
              <span className="text-red-400 font-bold">Error:</span> {this.state.error?.message || 'Unknown render exception'}
              {this.state.error?.stack && (
                <pre className="mt-1 text-[9px] leading-tight opacity-75">{this.state.error.stack.split('\n').slice(0, 3).join('\n')}</pre>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <button
                onClick={() => window.location.reload()}
                className="py-2.5 px-4 rounded-xl bg-white/25 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 text-cozy-night-300 dark:text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>

              <button
                onClick={this.handleReset}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-tr from-cozy-amber to-cozy-amber-dark text-white font-bold text-xs uppercase tracking-wider hover:brightness-115 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cozy-amber/10"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reset App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
