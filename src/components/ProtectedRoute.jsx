import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cozy-cream-50 dark:bg-cozy-night-300 transition-colors duration-500">
        {/* Soft glowing loader spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-cozy-amber/20 dark:border-cozy-amber-light/10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cozy-amber animate-spin" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-cozy-night-100/40 dark:text-cozy-cream-200/40">
          Gathering your shelves...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
