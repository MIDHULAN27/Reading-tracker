import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute';
import PremiumLoginModal from './components/PremiumLoginModal';
import DashboardLayout from './layouts/DashboardLayout';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './store/useAuthStore';
import { useSidebarStore } from './store/useSidebarStore';
import SetupHelper from './components/SetupHelper';

// Code-splitting all route entry-points for major Bundle & FCP Optimizations
const Auth = lazy(() => import('./pages/Auth'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Library = lazy(() => import('./pages/Library'));
const Discover = lazy(() => import('./pages/Discover'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const BookDetails = lazy(() => import('./pages/BookDetails'));
const Saved = lazy(() => import('./pages/Saved'));
const Profile = lazy(() => import('./pages/Profile'));
const Goals = lazy(() => import('./pages/Goals'));
const ReaderPage = lazy(() => import('./pages/ReaderPage'));

function AppContent() {
  const initialized = useAuthStore((state) => state.initialized);
  const hydrated = useSidebarStore((state) => state.hydrated);
  const tablesReady = useAuthStore((state) => state.tablesReady);
  const isConfigured = useAuthStore((state) => state.isConfigured);
  const databaseLoading = useAuthStore((state) => state.databaseLoading);

  // Hydration shield to prevent hydration mismatches and uninitialized rendering states
  // We also wait for database validation to complete to prevent UI flicker
  if (!initialized || !hydrated || databaseLoading) {
    return <LoadingScreen />;
  }

  // Database setup helper overlay if tables have not been created in Supabase yet
  if (isConfigured && !tablesReady) {
    return <SetupHelper />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      {/* Global Premium Login Modal — can be triggered from anywhere via useGuestGuardStore */}
      <PremiumLoginModal />

      <Routes>
        {/* Public Routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Dashboard Layout — Guest-browsable pages (allowGuest=true, the default) */}
        <Route
          element={
            <ProtectedRoute allowGuest={true}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* === GUEST-ACCESSIBLE (browse-only) === */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/book/:id" element={<BookDetails />} />

          {/* === AUTH-REQUIRED pages (still inside DashboardLayout but redirect guests) === */}
          <Route
            path="/library"
            element={
              <ProtectedRoute allowGuest={false}>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved-shelf"
            element={
              <ProtectedRoute allowGuest={false}>
                <Saved />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reading-profile"
            element={
              <ProtectedRoute allowGuest={false}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/goals"
            element={
              <ProtectedRoute allowGuest={false}>
                <Goals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowGuest={false}>
                <Suspense
                  fallback={
                    <div className="space-y-6 animate-pulse p-6">
                      <div className="h-8 bg-booklyn-cream-300/40 dark:bg-booklyn-night-100/30 rounded-xl w-1/3" />
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-36 bg-booklyn-cream-300/30 dark:bg-booklyn-night-100/20 rounded-3xl" />
                        ))}
                      </div>
                      <div className="h-80 bg-booklyn-cream-300/20 dark:bg-booklyn-night-100/15 rounded-3xl" />
                    </div>
                  }
                >
                  <Analytics />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowGuest={false}>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Protected Fullscreen Reader (Does not display Sidebar) */}
        <Route
          path="/read/:id"
          element={
            <ProtectedRoute allowGuest={false}>
              <ReaderPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 15 * 60 * 1000, // 15 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <SidebarProvider>
                <AppContent />
              </SidebarProvider>
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
