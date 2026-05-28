import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://omkgbynqmndlbjpyigbn.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta2dieW5xbW5kbGJqcHlpZ2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MjY5NDksImV4cCI6MjA5NTAwMjk0OX0._Rx0xZ9ubWY3atgRXMQGqLTKdaUoMH-XNDWy3LXEP_8';

const supabase = createClient(url, key);

async function test() {
  console.log("Checking user_library table with restructured columns...");
  
  // Select only the requested columns
  const { data, error } = await supabase
    .from('user_library')
    .select('id, user_id, book_id, title, author, cover_url, shelf_status, created_at')
    .limit(1);
    
  console.log("Result:", { data, error });
}

test();
