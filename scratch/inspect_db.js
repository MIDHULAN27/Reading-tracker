import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  // Let's try querying information_schema if enabled, or try querying users/goals table
  const { data: u, error: errU } = await supabase.from('users').select('*').limit(1);
  console.log('users select result:', u, errU);

  const { data: rg, error: errRg } = await supabase.from('reading_goals').select('*').limit(1);
  console.log('reading_goals select result:', rg, errRg);

  const { data: b, error: errB } = await supabase.from('books').select('*').limit(1);
  console.log('books select result:', b, errB);
}

inspect();
