import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './store/useAuthStore';
import { useSidebarStore } from './store/useSidebarStore';

// Code-splitting all route entry-points for major Bundle & FCP Optimizations
const Auth = lazy(() => import('./pages/Auth'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Library = lazy(() => import('./pages/Library'));
const Discover = lazy(() => import('./pages/Discover'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const BookDetails = lazy(() => import('./pages/BookDetails'));
const PaperDetails = lazy(() => import('./pages/PaperDetails'));
const Saved = lazy(() => import('./pages/Saved'));
const Profile = lazy(() => import('./pages/Profile'));
const Goals = lazy(() => import('./pages/Goals'));
const ReaderPage = lazy(() => import('./pages/ReaderPage'));

function AppContent() {
  const initialized = useAuthStore((state) => state.initialized);
  const hydrated = useSidebarStore((state) => state.hydrated);

  // Hydration shield to prevent hydration mismatches and uninitialized rendering states
  if (!initialized || !hydrated) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected Dashboard Layout Parent (Keeps sidebar/nav state permanently mounted) */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/book/:id" element={<BookDetails />} />
          <Route path="/paper/:id" element={<PaperDetails />} />
          <Route path="/saved-shelf" element={<Saved />} />
          <Route path="/reading-profile" element={<Profile />} />
          <Route path="/goals" element={<Goals />} />
          
          <Route
            path="/analytics"
            element={
              <Suspense
                fallback={
                  <div className="space-y-6 animate-pulse p-6">
                    <div className="h-8 bg-cozy-cream-300/40 dark:bg-cozy-night-100/30 rounded-xl w-1/3" />
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-36 bg-cozy-cream-300/30 dark:bg-cozy-night-100/20 rounded-3xl" />
                      ))}
                    </div>
                    <div className="h-80 bg-cozy-cream-300/20 dark:bg-cozy-night-100/15 rounded-3xl" />
                  </div>
                }
              >
                <Analytics />
              </Suspense>
            }
          />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Protected Fullscreen Reader (Does not display Sidebar) */}
        <Route
          path="/read/:id"
          element={
            <ProtectedRoute>
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

function App() {
  return (
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
  );
}

export default App;
