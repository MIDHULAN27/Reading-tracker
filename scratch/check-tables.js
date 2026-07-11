import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable(name) {
  try {
    const { data, error, status, statusText } = await supabase.from(name).select('*').limit(1);
    if (error) {
      console.log(`Table "${name}": ERROR - code: ${error.code}, message: ${error.message}, status: ${status}`);
      return { name, exists: false, error };
    } else {
      console.log(`Table "${name}": EXISTS - status: ${status}, data:`, data);
      return { name, exists: true };
    }
  } catch (err) {
    console.log(`Table "${name}": EXCEPTION - ${err.message}`);
    return { name, exists: false, error: err.message };
  }
}

async function main() {
  const tables = ['user_library', 'reading_library', 'bookshelf', 'shelves', 'library', 'books', 'users', 'reading_sessions', 'reading_goals', 'profiles'];
  console.log('Testing connection to Supabase:', supabaseUrl);
  console.log('--- Probing Tables ---');
  for (const t of tables) {
    await testTable(t);
  }
}

main();
