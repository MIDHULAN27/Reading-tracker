/**
 * Booklyn Table Validator
 * Probes all required Supabase tables at startup to detect missing schema.
 * Returns graceful status instead of crashing the app.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

// All tables that Booklyn requires to function
const REQUIRED_TABLES = [
  'users',
  'books',
  'user_library',
  'reviews',
  'reading_goals',
  'reading_sessions',
  'saved_papers',
  'reading_progress'
];

/**
 * Check if a specific error is a "table not found in schema cache" error
 * from PostgREST. This is the exact error pattern Supabase returns when
 * a table does not exist.
 */
export const isTableMissingError = (error) => {
  if (!error) return false;
  const msg = (error.message || error.toString()).toLowerCase();
  return (
    msg.includes('schema cache') ||
    msg.includes('relation') && msg.includes('does not exist') ||
    msg.includes('could not find the') ||
    msg.includes('404') && msg.includes('not found') ||
    error.code === '42P01' // PostgreSQL "undefined_table" error code
  );
};

/**
 * Probe a single table by attempting a lightweight HEAD count query.
 * Returns { table, exists, error }
 */
const probeTable = async (tableName) => {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('count', { count: 'exact', head: true });

    if (error) {
      if (isTableMissingError(error)) {
        return { table: tableName, exists: false, error: error.message };
      }
      // Table exists but may have RLS issues — that's okay, table is present
      return { table: tableName, exists: true, error: null };
    }

    return { table: tableName, exists: true, error: null };
  } catch (err) {
    // Network errors or other failures — assume unknown state but don't block
    return { table: tableName, exists: null, error: err.message };
  }
};

/**
 * Validate all required tables exist in the Supabase database.
 * Safe to call at any time — never throws, never crashes.
 *
 * @returns {{ allTablesReady: boolean, missingTables: string[], results: object[] }}
 */
export const validateTables = async () => {
  if (!isSupabaseConfigured) {
    return {
      allTablesReady: false,
      missingTables: REQUIRED_TABLES,
      results: REQUIRED_TABLES.map(t => ({ table: t, exists: false, error: 'Supabase not configured' }))
    };
  }

  try {
    // Probe all tables in parallel for speed (each is a lightweight HEAD query)
    const results = await Promise.all(
      REQUIRED_TABLES.map(tableName => probeTable(tableName))
    );

    const missingTables = results
      .filter(r => r.exists === false)
      .map(r => r.table);

    const allTablesReady = missingTables.length === 0;

    // Development-mode logging with clear remediation
    if (!allTablesReady && import.meta.env.DEV) {
      console.warn(
        `[Booklyn Table Validator] ⚠️ Missing database tables detected:\n` +
        missingTables.map(t => `  ❌ public.${t}`).join('\n') + '\n\n' +
        `🔧 To fix this:\n` +
        `  1. Open your Supabase Dashboard → SQL Editor\n` +
        `  2. Paste the contents of migration.sql from this project root\n` +
        `  3. Click "Run"\n` +
        `  4. Refresh this app\n`
      );
    } else if (allTablesReady && import.meta.env.DEV) {
      console.info('[Booklyn Table Validator] ✅ All 8 required database tables verified.');
    }

    return { allTablesReady, missingTables, results };
  } catch (err) {
    // Catch-all — never let validation crash the app
    if (import.meta.env.DEV) {
      console.warn('[Booklyn Table Validator] Validation failed unexpectedly:', err.message);
    }
    return {
      allTablesReady: false,
      missingTables: [],
      results: [],
      error: err.message
    };
  }
};

/**
 * Get a user-friendly error message for table-missing errors.
 * Used by stores to display actionable messages instead of raw PostgREST errors.
 */
export const getTableMissingMessage = (rawError) => {
  if (isTableMissingError({ message: rawError })) {
    return 'Database tables have not been created yet. Please run the SQL migration in your Supabase Dashboard SQL Editor.';
  }
  return null;
};
