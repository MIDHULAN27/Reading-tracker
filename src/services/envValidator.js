/**
 * Booklyn Environment Variable Validator Utility
 * Deeply validates Supabase connection variables at runtime.
 */
export const validateEnv = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  const issues = [];
  
  // 1. Validate Supabase URL
  if (!url) {
    issues.push("VITE_SUPABASE_URL is missing from your .env file.");
  } else if (url.includes("your-project-id") || url.includes("placeholder-project")) {
    issues.push("VITE_SUPABASE_URL contains placeholder values.");
  } else {
    try {
      new URL(url);
      if (!url.startsWith("https://")) {
        issues.push("VITE_SUPABASE_URL must secure-connect via https:// protocol.");
      }
    } catch (_) {
      issues.push("VITE_SUPABASE_URL is not a valid URL string.");
    }
  }
  
  // 2. Validate Supabase Anon Key
  if (!anonKey) {
    issues.push("VITE_SUPABASE_ANON_KEY is missing from your .env file.");
  } else if (anonKey.includes("your-supabase-anon-key") || anonKey.includes("placeholder-anon-key")) {
    issues.push("VITE_SUPABASE_ANON_KEY contains placeholder values.");
  } else if (!anonKey.startsWith("eyJ")) {
    issues.push("VITE_SUPABASE_ANON_KEY does not appear to be a valid JWT secret.");
  } else if (anonKey.length < 40) {
    issues.push("VITE_SUPABASE_ANON_KEY length is too short to be a secure key.");
  }
  
  const isValid = issues.length === 0;
  
  return {
    isValid,
    issues,
    url,
    anonKey
  };
};
