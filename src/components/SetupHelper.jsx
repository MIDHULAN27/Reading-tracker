import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Database, AlertTriangle, Copy, Check, RefreshCw, ExternalLink, Lock } from 'lucide-react';
import migrationSql from '../../migration.sql?raw';

export default function SetupHelper() {
  const { missingTables, checkConfig } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(migrationSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleRecheck = async () => {
    setChecking(true);
    try {
      await checkConfig();
    } catch (err) {
      console.error('Re-check failed: ', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-booklyn-night-300 dark:bg-booklyn-night-300 text-booklyn-night-100 dark:text-booklyn-cream-50 flex items-center justify-center p-4 relative font-sans overflow-y-auto">
      {/* Background ambient glowing spheres */}
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-booklyn-amber/5 blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-booklyn-amber/5 blur-3xl pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-3xl glass-panel border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 sm:space-y-8 my-8 shadow-2xl backdrop-blur-md">
        
        {/* Title & Warning Icon */}
        <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-white/10 pb-6">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-white leading-tight">
              Database Setup Required
            </h1>
            <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
              Booklyn connected to Supabase successfully, but some required database tables are missing.
            </p>
          </div>
        </div>

        {/* Missing Tables List */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase font-bold tracking-widest text-amber-400/90 flex items-center gap-1.5">
            <Database className="w-4 h-4" />
            <span>Missing Tables Detected ({missingTables.length})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {missingTables.map((table) => (
              <span 
                key={table}
                className="px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-semibold"
              >
                public.{table}
              </span>
            ))}
          </div>
        </div>

        {/* Remediations instructions */}
        <div className="bg-black/25 p-5 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-booklyn-amber text-booklyn-night-300 font-bold text-xs">1</span>
            <span>How to run the database migration script:</span>
          </h3>
          <ol className="list-decimal pl-5 space-y-2 text-xs text-booklyn-night-100/80 dark:text-booklyn-cream-200/70 leading-relaxed">
            <li>
              Copy the complete SQL migration code shown in the editor box below.
            </li>
            <li>
              Go to your{' '}
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noreferrer"
                className="text-booklyn-amber font-semibold hover:underline inline-flex items-center gap-1"
              >
                Supabase Dashboard <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and navigate to your project.
            </li>
            <li>
              Open the <b>SQL Editor</b> page from the left sidebar and click <b>New Query</b>.
            </li>
            <li>
              Paste the copied SQL and click <b>Run</b> at the bottom right.
            </li>
            <li>
              Come back here and click <b>Re-Check Database Connection</b>.
            </li>
          </ol>
        </div>

        {/* SQL Code Block Editor */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35">
              migration.sql
            </span>
            <button 
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5 select-none active:scale-95 border border-white/10 shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Schema SQL</span>
                </>
              )}
            </button>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
            <textarea
              readOnly
              value={migrationSql}
              rows="12"
              className="w-full p-4 font-mono text-[11px] leading-relaxed text-booklyn-cream-200/80 bg-transparent resize-none focus:outline-none custom-scrollbar"
            />
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleRecheck}
            disabled={checking}
            className="flex-1 py-3 bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-booklyn-amber/15 select-none active:scale-98 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Validating Database...' : 'Re-Check Database Connection'}</span>
          </button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="sm:w-56 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 select-none active:scale-98 transition-all text-center"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Supabase Console</span>
          </a>
        </div>

      </div>
    </div>
  );
}
