import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

/**
 * ProtectedRoute — now guest-aware.
 * 
 * - `allowGuest` (default: true): If true, unauthenticated users can view the
 *   page (browsing mode). The page itself is responsible for gating individual
 *   actions via the useGuestGuard hook.
 * - `allowGuest=false`: Redirects unauthenticated users to the premium login
 *   modal trigger or the /auth page (used for reader, goals, etc.).
 */
export default function ProtectedRoute({ children, allowGuest = true }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-booklyn-cream-50 dark:bg-booklyn-night-300 transition-colors duration-500">
        {/* Soft glowing loader spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-booklyn-amber/20 dark:border-booklyn-amber-light/10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-booklyn-amber animate-spin" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/40">
          Gathering your shelves...
        </p>
      </div>
    );
  }

  // If guest access is allowed, render children regardless of auth state
  if (allowGuest) {
    return children;
  }

  const isGuest = !user || user.is_anonymous || user.email?.includes('guest');

  // Strict auth required — redirect guests to /auth
  if (isGuest) {
    console.log("Protected feature clicked");
    const currentPath = location.pathname + location.search;
    localStorage.setItem("redirectAfterLogin", currentPath);
    return <Navigate to="/auth" replace state={{ from: currentPath, isPush: false }} />;
  }

  return children;
}
