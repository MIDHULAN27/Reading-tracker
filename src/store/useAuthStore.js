import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbService } from '../services/db';
import { supabase } from '../services/supabaseClient';
import { validateEnv } from '../services/envValidator';
import { validateTables } from '../services/tableValidator';

// ─── Timeout Utility ───────────────────────────────────────────
// Wraps any promise with a hard timeout to prevent infinite hangs
const AUTH_TIMEOUT_MS = 10000; // 10 seconds

const withTimeout = (promise, ms = AUTH_TIMEOUT_MS, label = 'Auth operation') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s. Please check your connection and try again.`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// ─── Friendly Error Mapper ─────────────────────────────────────
const getFriendlyAuthError = (error) => {
  const msg = (error?.message || 'An unexpected error occurred.').toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Your email has not been confirmed. Please check your inbox for a verification link.';
  }
  if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('23505')) {
    return 'This email address is already registered. Please sign in instead.';
  }
  if (msg.includes('password should be') || msg.includes('weak password')) {
    return 'Your password is too weak. Please use at least 6 characters with numbers/symbols.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
    return 'Network connection failed. Please check your internet access and try again.';
  }
  if (msg.includes('timed out')) {
    return error.message; // Already friendly from withTimeout
  }
  if (msg.includes('session') && msg.includes('expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many requests. Please wait a moment before trying again.';
  }
  if (msg.includes('database') || msg.includes('insert') || msg.includes('profile')) {
    return 'Could not initialize user profile in database. Please check RLS policies.';
  }
  if (msg.includes('email') && (msg.includes('invalid') || msg.includes('format'))) {
    return 'The email address format is invalid. Please double check.';
  }
  if (msg.includes('unconfigured') || msg.includes('placeholder')) {
    return error.message; // Already user-friendly
  }

  return error?.message || 'Authentication failed. Please try again.';
};


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
      tablesReady: false,
      missingTables: [],

  init: async () => {
    if (get().unsubscribe) {
      set({ loading: false, initialized: true });
      return;
    }
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
      // 1. Dynamic database validation check (with timeout)
      let connectionWorks = false;
      try {
        connectionWorks = await withTimeout(
          dbService.verifyConnection(),
          AUTH_TIMEOUT_MS,
          'Database connection check'
        );
      } catch (connErr) {
        console.warn('[Booklyn Auth] Database connection check failed or timed out:', connErr.message);
      }
      
      if (!connectionWorks) {
        console.warn('[Booklyn Auth] PostgreSQL connection check returned inactive. Database tables might not be ready.');
        set({ tablesReady: false, missingTables: [] });
      } else {
        console.info('[Booklyn Auth] PostgreSQL Connection verified. Reading schema tables active.');
        const validation = await validateTables();
        set({ 
          tablesReady: validation.allTablesReady, 
          missingTables: validation.missingTables 
        });
      }

      // 2. Recover existing active session if available (with timeout)
      let session = null;
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'Session recovery'
        );
        session = sessionResult?.data?.session || null;
      } catch (sessionErr) {
        console.warn('[Booklyn Auth] Session recovery failed or timed out:', sessionErr.message);
      }
      
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
      set({ error: getFriendlyAuthError(error), user: null, initialized: true, loading: false });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  checkConfig: async () => {
    set({ loading: true, error: null });
    console.info('[Booklyn Auth] Re-checking environment variable configuration...');
    
    try {
      const envResult = validateEnv();
      set({ isConfigured: envResult.isValid, envIssues: envResult.issues });
      
      if (envResult.isValid) {
        console.info('[Booklyn Auth] Environment variables resolved! Verifying live connection...');
        
        let connectionWorks = false;
        try {
          connectionWorks = await withTimeout(
            dbService.verifyConnection(),
            AUTH_TIMEOUT_MS,
            'Database retry connection'
          );
        } catch (connErr) {
          console.error('[Booklyn Auth] Connection retry timed out:', connErr.message);
          set({ error: connErr.message });
          return envResult;
        }
        
        if (connectionWorks) {
          console.info('[Booklyn Auth] Connection successful! Activating auth exchange listeners...');
          const validation = await validateTables();
          set({ 
            tablesReady: validation.allTablesReady, 
            missingTables: validation.missingTables 
          });
          // Recover session if any
          try {
            const { data: { session } } = await withTimeout(
              supabase.auth.getSession(),
              AUTH_TIMEOUT_MS,
              'Session recovery during retry'
            );
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
      
      return envResult;
    } catch (err) {
      console.error('[Booklyn Auth] checkConfig error:', err.message);
      set({ error: getFriendlyAuthError(err) });
      return { isValid: false, issues: [err.message] };
    } finally {
      set({ loading: false });
    }
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
      const data = await withTimeout(
        dbService.auth.signUp(email, password, fullName),
        AUTH_TIMEOUT_MS,
        'Sign up request'
      );
      console.info('[Booklyn Auth Store] signUp response in store:', data);
      
      if (data.session) {
        set({ user: data.user });
      }
      return data;
    } catch (error) {
      const friendlyMessage = getFriendlyAuthError(error);
      console.error('[Booklyn Auth Store] signUp Error:', friendlyMessage, error);
      set({ error: friendlyMessage });
      throw new Error(friendlyMessage);
    } finally {
      set({ loading: false });
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
      console.info('[Booklyn Auth Store] Attempting signIn for:', email);
      const data = await withTimeout(
        dbService.auth.signIn(email, password),
        AUTH_TIMEOUT_MS,
        'Sign in request'
      );
      console.info('[Booklyn Auth Store] signIn successful for:', email);
      set({ user: data.user });
      return data;
    } catch (error) {
      const friendlyMessage = getFriendlyAuthError(error);
      console.error('[Booklyn Auth Store] signIn Error:', friendlyMessage, error);
      set({ error: friendlyMessage });
      throw new Error(friendlyMessage);
    } finally {
      set({ loading: false });
    }
  },

  signInWithGoogle: async () => {
    // NOTE: Google OAuth triggers a full browser redirect, so we do NOT
    // set loading=true here — the page will unload and loading state
    // would persist stale if we set it before redirect.
    set({ error: null });
    const envResult = validateEnv();
    if (!envResult.isValid) {
      const err = new Error('Supabase URL/Anon Key is unconfigured in your .env file.');
      set({ error: err.message });
      throw err;
    }
    try {
      console.info('[Booklyn Auth Store] Initiating Google OAuth redirect...');
      const data = await dbService.auth.signInWithGoogle();
      // If we reach here without redirect, handle the edge case
      if (data?.user) {
        set({ user: data.user });
      }
      return data;
    } catch (error) {
      const friendlyMessage = getFriendlyAuthError(error);
      console.error('[Booklyn Auth Store] Google OAuth Error:', friendlyMessage, error);
      set({ error: friendlyMessage });
      throw new Error(friendlyMessage);
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
      const data = await withTimeout(
        dbService.auth.resetPasswordForEmail(email),
        AUTH_TIMEOUT_MS,
        'Password reset request'
      );
      return data;
    } catch (error) {
      const friendlyMessage = getFriendlyAuthError(error);
      console.error('[Booklyn Auth Store] resetPassword Error:', friendlyMessage, error);
      set({ error: friendlyMessage });
      throw new Error(friendlyMessage);
    } finally {
      set({ loading: false });
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
      const data = await withTimeout(
        dbService.auth.updateUserPassword(newPassword),
        AUTH_TIMEOUT_MS,
        'Password update request'
      );
      return data;
    } catch (error) {
      const friendlyMessage = getFriendlyAuthError(error);
      console.error('[Booklyn Auth Store] updatePassword Error:', friendlyMessage, error);
      set({ error: friendlyMessage });
      throw new Error(friendlyMessage);
    } finally {
      set({ loading: false });
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
      const data = await withTimeout(
        dbService.auth.guestLogin(),
        AUTH_TIMEOUT_MS,
        'Guest login request'
      );
      set({ user: data.user });
      return data;
    } catch (error) {
      const friendlyMessage = getFriendlyAuthError(error);
      console.error('[Booklyn Auth Store] guestLogin Error:', friendlyMessage, error);
      set({ error: friendlyMessage });
      throw new Error(friendlyMessage);
    } finally {
      set({ loading: false });
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
      await withTimeout(
        dbService.auth.signOut(),
        AUTH_TIMEOUT_MS,
        'Sign out request'
      );
      
      // Reset unsubscribe subscription on signout if present
      const unsub = get().unsubscribe;
      if (unsub) unsub();
      
      set({ user: null, unsubscribe: null });
    } catch (error) {
      console.error('[Booklyn Auth Store] signOut Error:', error.message);
      // Force clear user state even if signOut API call fails
      const unsub = get().unsubscribe;
      if (unsub) unsub();
      set({ user: null, error: error.message, unsubscribe: null });
    } finally {
      set({ loading: false });
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
