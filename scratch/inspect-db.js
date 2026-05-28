import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://omkgbynqmndlbjpyigbn.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta2dieW5xbW5kbGJqcHlpZ2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MjY5NDksImV4cCI6MjA5NTAwMjk0OX0._Rx0xZ9ubWY3atgRXMQGqLTKdaUoMH-XNDWy3LXEP_8';

const supabase = createClient(url, key);

async function test() {
  console.log("Testing Supabase connection...");
  
  // 1. Let's try to query public.users
  const { data: users, error: usersErr } = await supabase.from('users').select('*').limit(1);
  console.log("Users query result:", { users, usersErr });

  // 2. Let's try to query public.books
  const { data: books, error: booksErr } = await supabase.from('books').select('*').limit(1);
  console.log("Books query result:", { books, booksErr });

  // 3. Let's try to query public.user_library
  const { data: userLib, error: userLibErr } = await supabase.from('user_library').select('*').limit(1);
  console.log("User library query result:", { userLib, userLibErr });
}

test();
