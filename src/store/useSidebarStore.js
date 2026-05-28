import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSidebarStore = create(
  persist(
    (set, get) => ({
      activeRoute: '/',
      selectedSidebarItem: 'Home',
      isSidebarCollapsed: false,
      theme: 'dark', // default theme
      recentRoutes: [],
      hydrated: false,

      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      
      setActiveRoute: (route) => {
        set({ activeRoute: route });
        const current = get().recentRoutes || [];
        if (route && route !== '/auth' && route !== '/auth/callback' && !current.includes(route)) {
          set({ recentRoutes: [route, ...current].slice(0, 5) });
        }
      },

      setSelectedSidebarItem: (item) => set({ selectedSidebarItem: item }),
      
      setTheme: (theme) => set({ theme }),
      
      toggleTheme: () => {
        const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: nextTheme });
        
        // Immediate client-side DOM sync
        const root = window.document.documentElement;
        const body = window.document.body;
        if (nextTheme === 'dark') {
          root.classList.add('dark');
          body.classList.add('dark');
        } else {
          root.classList.remove('dark');
          body.classList.remove('dark');
        }
      },

      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'booklyn-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);
