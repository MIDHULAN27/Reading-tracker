import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', url);
console.log('Key length:', key ? key.length : 0);

if (!url || !key) {
  console.error('Error: missing env variables');
  process.exit(1);
}

const supabase = createClient(url, key);

const tables = [
  'users',
  'books',
  'user_library',
  'reviews',
  'reading_goals',
  'reading_sessions',
  'saved_papers',
  'reading_progress'
];

async function check() {
  console.log('Probing tables...');
  for (const table of tables) {
    try {
      const { data, error, status } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`Table "${table}": Error (status ${status}) ->`, error.code, error.message);
      } else {
        console.log(`Table "${table}": OK (status ${status})`);
      }
    } catch (err) {
      console.log(`Table "${table}": Exceptional error ->`, err);
    }
  }
}

check();
