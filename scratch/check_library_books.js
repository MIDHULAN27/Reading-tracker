import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Read env variables
const envContent = fs.readFileSync('/Users/midhulanj/Reading tracker/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
  const { data: { user } } = await supabase.auth.getUser(); // or just query user_library
  
  // Since we might not be authenticated in the node script, let's query public tables directly
  const { data: library, error } = await supabase
    .from('user_library')
    .select(`
      id,
      user_id,
      status,
      title,
      author,
      cover_url,
      has_pdf,
      book_id,
      books (
        id,
        title,
        author,
        googlebooks_id,
        openlibrary_id
      )
    `);
    
  if (error) {
    console.error('Error fetching library:', error);
    return;
  }

  console.log('--- Current Books in User Library ---');
  library.forEach(entry => {
    const book = entry.books;
    console.log(`- Entry ID: ${entry.id}`);
    console.log(`  Title: ${entry.title || book?.title}`);
    console.log(`  Author: ${entry.author || book?.author}`);
    console.log(`  Book ID (UUID): ${entry.book_id}`);
    console.log(`  Gutenberg ID: ${book?.openlibrary_id}`);
    console.log(`  Google ID: ${book?.googlebooks_id}`);
    console.log(`  Has PDF: ${entry.has_pdf}`);
  });
}

run();
