import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbService } from '../services/db';
import { supabase } from '../services/supabaseClient';
import { validateEnv } from '../services/envValidator';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      error: null,
      initialized: false,
      unsubscribe: null,
      isConfigured: false,
      envIssues: [],

  init: async () => {
    if (get().initialized) return;
    set({ loading: true, error: null });

    console.info('[Booklyn Auth] Initializing authentication state...');
    
    // Perform dynamic environment validation check
    const envResult = validateEnv();
    set({ isConfigured: envResult.isValid, envIssues: envResult.issues });

    if (!envResult.isValid) {
      console.warn(
        '[Booklyn Auth] Environment check failed. Booklyn is in Unconfigured Mode.\n' +
        'Reasons:\n' + envResult.issues.map(i => ` - ${i}`).join('\n')
      );
      set({ 
        user: null, 
        initialized: true, 
        loading: false 
      });
      return;
    }

    console.info('[Booklyn Auth] Supabase configuration validated successfully. Checking connection...');

    try {
      // 1. Dynamic database validation check
      const connectionWorks = await dbService.verifyConnection();
      
      if (!connectionWorks) {
        console.warn('[Booklyn Auth] PostgreSQL connection check returned inactive. Database tables might not be ready.');
      } else {
        console.info('[Booklyn Auth] PostgreSQL Connection verified. Reading schema tables active.');
      }

      // 2. Recover existing active session if available
      const { data: { session } } = await supabase.auth.getSession();
      
      // Auto synchronize profile on session recovery
      set({ 
        user: session?.user || null, 
        initialized: true, 
        loading: false 
      });

      // 3. Subscribe to auth state updates to prevent timing issues or stale refreshes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.info(`[Booklyn Auth] Auth state changed event: ${event}`);
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            set({ user: session?.user || null, loading: false });
          } else if (event === 'SIGNED_OUT') {
            set({ user: null, loading: false });
          }
        }
      );

      set({ unsubscribe: () => subscription.unsubscribe() });
    } catch (error) {
      console.error('[Booklyn Auth] Error during initialization:', error.message);
      set({ error: error.message, user: null, initialized: true, loading: false });
    }
  },

  checkConfig: async () => {
    set({ loading: true, error: null });
    console.info('[Booklyn Auth] Re-checking environment variable configuration...');
    
    const envResult = validateEnv();
    set({ isConfigured: envResult.isValid, envIssues: envResult.issues });
    
    if (envResult.isValid) {
      console.info('[Booklyn Auth] Environment variables resolved! Verifying live connection...');
      // Re-run database validation directly
      const connectionWorks = await dbService.verifyConnection();
      
      if (connectionWorks) {
        console.info('[Booklyn Auth] Connection successful! Activating auth exchange listeners...');
        // Recover session if any
        try {
          const { data: { session } } = await supabase.auth.getSession();
          set({ user: session?.user || null });
          
          // Re-subscribe if not subscribed
          if (!get().unsubscribe) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
              async (event, session) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                  set({ user: session?.user || null, loading: false });
                } else if (event === 'SIGNED_OUT') {
                  set({ user: null, loading: false });
                }
              }
            );
            set({ unsubscribe: () => subscription.unsubscribe() });
          }
        } catch (err) {
          console.error('[Booklyn Auth] Session recovery failed during retry:', err.message);
        }
      } else {
        set({ error: 'Database credentials entered are invalid or PostgreSQL is unreachable.' });
      }
    } else {
      set({ error: 'Supabase URL/Anon Key is unconfigured in your .env file.' });
    }
    
    set({ loading: false });
    return envResult;
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true, error: null });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const err = new Error('Supabase URL/Anon Key is unconfigured in your .env file.');
      set({ error: err.message, loading: false });
      throw err;
    }
    try {
      console.info('[Booklyn Auth Store] Attempting signUp for:', email);
      const data = await dbService.auth.signUp(email, password, fullName);
      console.info('[Booklyn Auth Store] signUp response in store:', data);
      
      if (data.session) {
        set({ user: data.user, loading: false });
      } else {
        set({ loading: false });
      }
      return data;
    } catch (error) {
      let friendlyMessage = error.message || 'An error occurred during account creation.';
      const errMsg = friendlyMessage.toLowerCase();
      if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('23505')) {
        friendlyMessage = 'This email address is already registered. Please sign in instead.';
      } else if (errMsg.includes('password should be') || errMsg.includes('weak password')) {
        friendlyMessage = 'Your password is too weak. Please use at least 6 characters with numbers/symbols.';
      } else if (errMsg.includes('failed to fetch') || errMsg.includes('network error') || errMsg.includes('network failure')) {
        friendlyMessage = 'Network connection failed. Please check your internet access and try again.';
      } else if (errMsg.includes('database') || errMsg.includes('insert') || errMsg.includes('profile')) {
        friendlyMessage = 'Could not initialize user profile in database. Please check RLS policies.';
      } else if (errMsg.includes('email') && (errMsg.includes('invalid') || errMsg.includes('format'))) {
        friendlyMessage = 'The email address format is invalid. Please double check.';
      }
      
      console.error('[Booklyn Auth Store] signUp Error:', friendlyMessage, error);
      set({ error: friendlyMessage, loading: false });
      throw new Error(friendlyMessage);
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const err = new Error('Supabase URL/Anon Key is unconfigured in your .env file.');
      set({ error: err.message, loading: false });
      throw err;
    }
    try {
      const data = await dbService.auth.signIn(email, password);
      set({ user: data.user, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const err = new Error('Supabase URL/Anon Key is unconfigured in your .env file.');
      set({ error: err.message, loading: false });
      throw err;
    }
    try {
      const data = await dbService.auth.signInWithGoogle();
      if (data?.user) {
        set({ user: data.user, loading: false });
      }
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const err = new Error('Supabase URL/Anon Key is unconfigured in your .env file.');
      set({ error: err.message, loading: false });
      throw err;
    }
    try {
      const data = await dbService.auth.resetPasswordForEmail(email);
      set({ loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updatePassword: async (newPassword) => {
    set({ loading: true, error: null });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const err = new Error('Supabase URL/Anon Key is unconfigured in your .env file.');
      set({ error: err.message, loading: false });
      throw err;
    }
    try {
      const data = await dbService.auth.updateUserPassword(newPassword);
      set({ loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  guestLogin: async () => {
    set({ loading: true, error: null });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const err = new Error('Supabase URL/Anon Key is unconfigured in your .env file.');
      set({ error: err.message, loading: false });
      throw err;
    }
    try {
      const data = await dbService.auth.guestLogin();
      set({ user: data.user, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ loading: true });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const unsub = get().unsubscribe;
      if (unsub) unsub();
      set({ user: null, loading: false, unsubscribe: null });
      return;
    }
    try {
      await dbService.auth.signOut();
      
      // Reset unsubscribe subscription on signout if present
      const unsub = get().unsubscribe;
      if (unsub) unsub();
      
      set({ user: null, loading: false, unsubscribe: null });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  
  clearError: () => set({ error: null })
}),
{
  name: 'booklyn-auth-storage',
  partialize: (state) => ({
    user: state.user,
    initialized: state.initialized,
    isConfigured: state.isConfigured,
  }),
}
)
);
