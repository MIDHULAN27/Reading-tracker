import { createClient } from '@supabase/supabase-js';
import { validateEnv } from './envValidator';

// Run environment checks on startup
const env = validateEnv();

export const isSupabaseConfigured = env.isValid;

if (!isSupabaseConfigured) {
  console.warn(
    'Booklyn Developer Alert: Supabase environment variables are missing or unconfigured.\n' +
    'Issues detected:\n' + env.issues.map(issue => ` - ${issue}`).join('\n') + '\n' +
    'Please edit the .env file in your project root to link a live Supabase PostgreSQL server.'
  );
}

// Centralized singleton Supabase client with production options
export const supabase = createClient(
  isSupabaseConfigured ? env.url : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? env.anonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
