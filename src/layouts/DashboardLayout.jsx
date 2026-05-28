import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate, Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useTheme } from '../context/ThemeContext';
import { dbService } from '../services/db';
import { useSidebar } from '../context/SidebarContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  Home, BookOpen, Search, BarChart2, Settings, LogOut, 
  Menu, X, Sun, Moon, ChevronLeft, ChevronRight, User, Database,
  Bell, Bookmark, CheckCircle, Target, Award, ShieldAlert, Sparkles,
  Inbox, Check, Trash
} from 'lucide-react';
import logoBrandLight from '../assets/logo-brand-light.png';
import logoBrandDarkWhite from '../assets/logo-brand-dark-white.png';
import logoBrandDarkGold from '../assets/logo-brand-dark-gold.png';
import logoEmblemLight from '../assets/logo-emblem-light.png';
import logoEmblemDarkWhite from '../assets/logo-emblem-dark-white.png';
import logoEmblemDarkGold from '../assets/logo-emblem-dark-gold.png';
import { motion, AnimatePresence } from 'framer-motion';
import BookDetailSlideOver from '../components/BookDetailSlideOver';
import SyncStatusBanner from '../components/SyncStatusBanner';
import useSEOSync from '../hooks/useSEOSync';
import { NotificationDropdown, ProfileDropdown } from '../components/NavbarDropdowns';

export default function DashboardLayout({ children }) {
  useSEOSync();
  const { 
    isSidebarCollapsed, 
    setSidebarCollapsed, 
    activeRoute, 
    setActiveRoute 
  } = useSidebar();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const { user, signOut } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { books, fetchBooks } = useLibraryStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Synchronize router location with active route in Zustand store
  useEffect(() => {
    if (location.pathname) {
      setActiveRoute(location.pathname);
    }
  }, [location.pathname, setActiveRoute]);

  // Dialog State for Search clicks
  const [selectedBook, setSelectedBook] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Refs for closing panels on outside clicks
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  const isSupabase = true;

  // Notification items state
  const [notifications, setNotifications] = useState([
    { id: 1, text: "🔥 You've reached your daily goal of 20 reading minutes! Streak extended!", read: false, time: "Just now", type: "streak" },
    { id: 2, text: "📚 Added 'The Hobbit' to Currently Reading. Don't forget to track your session!", read: false, time: "2 hours ago", type: "book" },
    { id: 3, text: "🎯 New recommendation curated based on your favorite genre: Sci-Fi!", read: true, time: "Yesterday", type: "recommend" }
  ]);

  // Sidebar items
  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Discover', path: '/discover', icon: Search },
    { label: 'My Library', path: '/library', icon: BookOpen },
    { label: 'Saved Shelf', path: '/saved-shelf', icon: Bookmark },
    { label: 'Reading Profile', path: '/reading-profile', icon: Award },
    { label: 'Analytics', path: '/analytics', icon: BarChart2 },
    { label: 'Goals', path: '/goals', icon: Target },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  // Mobile Bottom nav items (Spotify inspired)
  const mobileBottomItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Discover', path: '/discover', icon: Search },
    { label: 'Saved', path: '/saved-shelf', icon: Bookmark },
    { label: 'Profile', path: '/reading-profile', icon: Award },
    { label: 'Library', path: '/library', icon: BookOpen },
  ];

  // Fetch books on mount if empty
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const matches = books.filter(b => 
      b.title.toLowerCase().includes(query) || 
      b.author.toLowerCase().includes(query)
    );
    setSearchResults(matches.slice(0, 5));
  }, [searchQuery, books]);

  // Close elements on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchQuery('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/auth');
  }, [signOut, navigate]);

  const closeProfileDropdown = useCallback(() => {
    setIsProfileDropdownOpen(false);
  }, []);

  const getUserInitials = () => {
    if (!user) return 'R';
    const name = user.user_metadata?.full_name || user.email || 'Cozy Reader';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const toggleReadNotification = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  }, []);

  const deleteNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleResultClick = (book) => {
    setSelectedBook(book);
    setIsSlideOverOpen(true);
    setSearchQuery('');
  };

  const isActive = (itemPath) => {
    if (itemPath === '/') {
      return location.pathname === '/';
    }
    return location.pathname + location.search === itemPath || location.pathname.startsWith(itemPath.split('?')[0]);
  };

  return (
    <div className="min-h-screen flex bg-cozy-cream-50 dark:bg-cozy-night-300 text-cozy-night-100 dark:text-cozy-cream-50 transition-colors duration-500 overflow-hidden relative font-sans">
      {/* Background ambient glowing spheres */}
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none z-0" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full ambient-glow-2 pointer-events-none z-0" />

      {/* DESKTOP SIDEBAR */}
      <aside 
        role="complementary"
        aria-label="Desktop navigation sidebar"
        className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-white/15 dark:border-white/5 glass-panel z-30 transition-all duration-300 select-none ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Header */}
        <div className={`flex items-center border-b border-white/10 transition-all duration-300 ${
          isSidebarCollapsed 
            ? 'px-3 py-5 flex-col gap-4 justify-center' 
            : 'p-6 justify-between'
        }`}>
          <div className="flex items-center overflow-hidden select-none">
            {isSidebarCollapsed ? (
              <img
                src={theme === 'dark' ? logoEmblemDarkGold : logoEmblemLight}
                alt="Booklyn Logo Emblem"
                className="w-10 h-10 object-contain transition-all duration-300 filter drop-shadow-[0_0_10px_rgba(255,184,77,0.3)] dark:drop-shadow-[0_0_15px_rgba(255,184,77,0.55)] hover:scale-110 will-change-transform transform-gpu"
              />
            ) : (
              <img
                src={theme === 'dark' ? logoBrandDarkGold : logoBrandLight}
                alt="Booklyn Brand Logo"
                className="h-[38px] w-auto object-contain transition-all duration-300 filter drop-shadow-[0_0_10px_rgba(255,184,77,0.3)] dark:drop-shadow-[0_0_15px_rgba(255,184,77,0.55)] hover:scale-105 will-change-transform transform-gpu"
              />
            )}
          </div>
          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-cozy-night-100/50 hover:text-cozy-night-100 dark:text-cozy-cream-200/50 dark:hover:text-cozy-cream-100 bg-white/15 dark:bg-white/5 border border-white/10 hover:scale-105 active:scale-95 transition-all"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav aria-label="Desktop sidebar navigation" className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <NavLink 
                key={item.path} 
                to={item.path}
                className="block relative group"
              >
                <div className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 relative ${
                  active 
                    ? 'glass-panel bg-white/40 dark:bg-white/10 text-cozy-amber dark:text-cozy-amber-light font-semibold shadow-sm' 
                    : 'hover:bg-white/20 dark:hover:bg-white/5 text-cozy-night-100/70 dark:text-cozy-cream-200/60 hover:text-cozy-night-100 dark:hover:text-cozy-cream-100'
                }`}>
                  <Icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-105 ${active ? 'text-cozy-amber dark:text-cozy-amber-light' : 'text-cozy-night-100/50 dark:text-cozy-cream-200/40 group-hover:text-cozy-amber'}`} />
                  {!isSidebarCollapsed && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-semibold tracking-wide"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {active && (
                    <motion.div 
                      layoutId="active-pill" 
                      className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-cozy-amber rounded-full" 
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 space-y-4">
          {/* User Profile summary card */}
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cozy-amber to-cozy-lavender text-white flex items-center justify-center text-sm font-bold font-sans shadow-md flex-shrink-0 border border-white/20">
              {getUserInitials()}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">
                  {user?.user_metadata?.full_name || 'Cozy Reader'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Database className="w-3 h-3 text-green-500" />
                  <span className="text-[9px] font-bold tracking-wider uppercase text-cozy-night-100/40 dark:text-cozy-cream-200/40 truncate">
                    Cloud Sync
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWERS SIDEBAR */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-black z-50"
            />
            <motion.aside
              role="complementary"
              aria-label="Mobile navigation drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 bottom-0 left-0 w-72 glass-panel border-r border-white/10 z-60 flex flex-col p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 select-none">
                <div className="flex items-center gap-2">
                  <img
                    src={theme === 'dark' ? logoBrandDarkGold : logoBrandLight}
                    alt="Booklyn Brand Logo"
                    className="h-10 w-auto object-contain transition-all duration-300 filter drop-shadow-[0_0_10px_rgba(255,184,77,0.3)] dark:drop-shadow-[0_0_15px_rgba(255,184,77,0.55)] hover:scale-105 will-change-transform transform-gpu"
                  />
                </div>
                <button 
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 border border-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav aria-label="Mobile sidebar navigation" className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;

                  return (
                    <NavLink 
                      key={item.path} 
                      to={item.path}
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="block"
                    >
                      <div className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                        active 
                          ? 'bg-gradient-to-r from-cozy-amber to-cozy-amber-dark text-white font-semibold shadow-md shadow-cozy-amber/15' 
                          : 'hover:bg-white/10 text-cozy-night-100/70 dark:text-cozy-cream-200/60'
                      }`}>
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-xs font-semibold tracking-wide">{item.label}</span>
                      </div>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="border-t border-white/10 pt-4 space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cozy-amber to-cozy-lavender text-white flex items-center justify-center text-sm font-bold">
                    {getUserInitials()}
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      {user?.user_metadata?.full_name || 'Cozy Reader'}
                    </p>
                    <p className="text-[10px] text-cozy-night-100/40 dark:text-cozy-cream-200/40 truncate max-w-[150px]">
                      {user?.email || 'Guest Reader'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/25 active:scale-95 transition-all text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* CORE WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
        
        {/* STICKY TOP NAVBAR */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-6 py-3 flex items-center justify-between select-none">
          <div className="flex items-center gap-4 flex-1">
            {/* Sidebar toggle buttons */}
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 active:scale-95 transition-transform"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Premium Interactive Navbar Search Bar */}
            <div ref={searchRef} className="relative max-w-md w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cozy-night-100/40 dark:text-cozy-cream-200/35" />
              <input
                type="text"
                id="search-shelves"
                aria-label="Search all library shelves"
                placeholder="Search shelves (⌘K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                className="w-full !pl-10 !pr-12 py-2 glass-input rounded-xl text-xs focus:ring-1 focus:ring-cozy-amber/30 transition-all font-semibold"
              />
              <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 px-1.5 py-0.5 rounded-lg border border-cozy-cream-300 dark:border-cozy-night-100 bg-white/20 dark:bg-black/10 text-[9px] font-bold text-cozy-night-100/40 dark:text-cozy-cream-200/30">
                ⌘K
              </div>

              {/* Floating search dropdown panel */}
              <AnimatePresence>
                {searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-[110%] left-0 right-0 glass-overlay rounded-2xl p-2 border border-white/15 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] z-[100] max-h-80 overflow-y-auto space-y-1 custom-scrollbar text-xs pointer-events-auto"
                  >
                    <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-cozy-night-100/40 dark:text-cozy-cream-200/45 border-b border-white/5 flex items-center justify-between">
                      <span>Search Results ({searchResults.length})</span>
                      <Sparkles className="w-3 h-3 text-cozy-amber animate-pulse" />
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center text-cozy-night-100/50 dark:text-cozy-cream-200/40 italic flex flex-col items-center gap-1.5">
                        <ShieldAlert className="w-5 h-5 text-cozy-amber/60" />
                        <span>No books matching your query in library.</span>
                      </div>
                    ) : (
                      searchResults.map(book => (
                        <div
                          key={book.id}
                          onClick={() => handleResultClick(book)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/20 dark:hover:bg-white/10 cursor-pointer transition-all border border-transparent hover:border-white/5 active:scale-98"
                        >
                          <div className="w-8 h-11 rounded-lg overflow-hidden bg-cozy-cream-200 dark:bg-cozy-night-400 flex-shrink-0 shadow-sm">
                            {book.cover_url ? (
                              <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-tr ${book.cover_color} flex items-center justify-center text-[7px] text-white p-1 text-center font-bold font-serif`}>
                                {book.title.substring(0, 6)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-serif font-bold truncate leading-snug">{book.title}</h5>
                            <p className="text-[10px] text-cozy-night-100/50 dark:text-cozy-cream-200/40 truncate mt-0.5">by {book.author}</p>
                          </div>
                          <div className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-cozy-amber/10 text-cozy-amber border border-cozy-amber/20 capitalize">
                            {book.status === 'to_read' ? 'To Read' : book.status}
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT ACTION BUTTONS */}
          <div className="flex items-center gap-3 sm:gap-4 select-none">
            {/* 1. Theme selection toggler */}
            <button 
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
              aria-live="polite"
              className="p-2.5 rounded-xl bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 active:scale-95 hover:scale-105 transition-all text-cozy-amber dark:text-cozy-amber-light"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* 2. Responsive Glassmorphic Notification Dropdown Trigger */}
            <div ref={notificationRef} className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                aria-label="View notifications center"
                aria-expanded={isNotificationOpen}
                className="p-2.5 rounded-xl bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 active:scale-95 hover:scale-105 transition-all text-cozy-night-100 dark:text-cozy-cream-50 relative"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white font-sans font-bold text-[9px] flex items-center justify-center animate-pulse border-2 border-cozy-cream-50 dark:border-cozy-night-300">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationOpen && (
                  <NotificationDropdown
                    notifications={notifications}
                    unreadCount={unreadCount}
                    markAllNotificationsAsRead={markAllNotificationsAsRead}
                    toggleReadNotification={toggleReadNotification}
                    deleteNotification={deleteNotification}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* 3. Responsive User Dropdown Panel */}
            <div ref={profileRef} className="relative">
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                aria-label="User profile settings menu"
                aria-expanded={isProfileDropdownOpen}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-cozy-amber to-cozy-lavender text-white flex items-center justify-center font-sans font-bold shadow-md border-2 border-white/20 dark:border-white/10 active:scale-95 hover:scale-105 transition-all select-none"
              >
                {getUserInitials()}
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <ProfileDropdown
                    user={user}
                    initials={getUserInitials()}
                    handleSignOut={handleSignOut}
                    onClose={closeProfileDropdown}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* MAIN BODY AREA SCROLL CONTAINER */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-6 custom-scrollbar px-4 py-4 md:px-8 md:py-6 relative z-10">
          <div className="max-w-6xl w-full mx-auto relative">
            <ErrorBoundary local={true}>
              {children || <Outlet />}
            </ErrorBoundary>
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR (Thumb friendly, Spotify inspired) */}
        <nav 
          aria-label="Mobile navigation bar"
          className="md:hidden fixed bottom-4 left-4 right-4 h-16 rounded-2xl glass-panel border border-white/20 dark:border-white/10 shadow-2xl z-40 flex items-center justify-around px-2 backdrop-blur-lg select-none"
        >
          {mobileBottomItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <Link 
                key={item.path} 
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center h-full relative"
              >
                <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                  active 
                    ? 'bg-gradient-to-tr from-cozy-amber/20 to-cozy-lavender/20 text-cozy-amber dark:text-cozy-amber-light scale-105 shadow-sm' 
                    : 'text-cozy-night-100/50 dark:text-cozy-cream-200/40 hover:text-cozy-night-100 dark:hover:text-cozy-cream-50'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                {active && (
                  <motion.div 
                    layoutId="active-dot"
                    className="absolute bottom-1.5 w-1.5 h-1.5 bg-cozy-amber rounded-full shadow shadow-cozy-amber/50" 
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Global layout Detail Slideover panel */}
      <BookDetailSlideOver
        book={selectedBook}
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
      />

      {/* Real-time Global Sync Banner overlay */}
      <SyncStatusBanner />
    </div>
  );
}
