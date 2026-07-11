import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in env!");
  process.exit(1);
}

console.log("Using URL:", url);

const supabase = createClient(url, key);

const TABLES = [
  'users',
  'books',
  'user_library',
  'reviews',
  'reading_goals',
  'reading_sessions',
  'saved_papers',
  'reading_progress'
];

async function verify() {
  console.log("Probing tables...");
  for (const table of TABLES) {
    try {
      const { data, error, status } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table} returned error:`, error.message, `(Status: ${status})`);
      } else {
        console.log(`✅ Table ${table} verified. Limit 1 result:`, data);
      }
    } catch (err) {
      console.log(`💥 Exceptional error on table ${table}:`, err.message);
    }
  }
}

verify();
