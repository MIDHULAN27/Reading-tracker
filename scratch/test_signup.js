import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env file manually
const envPath = '/Users/midhulanj/Reading tracker/.env';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*VITE_(\w+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
});

const supabaseUrl = env['SUPABASE_URL'];
const supabaseAnonKey = env['SUPABASE_ANON_KEY'];

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using Supabase Anon Key length:', supabaseAnonKey ? supabaseAnonKey.length : 0);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: missing Supabase URL or Anon Key in .env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const testEmail = `tester-${Math.random().toString(36).substr(2, 9)}@booklyn.app`;
const testPassword = 'Password123!';
const testFullName = 'Booklyn Tester';

async function runTest() {
  console.log('\n--- 1. Testing Supabase signUp ---');
  console.log(`Signing up user with Email: ${testEmail}`);
  
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testFullName
      }
    }
  });

  if (error) {
    console.error('signUp Failed:', error.message);
    process.exit(1);
  }

  console.log('signUp Succeeded!');
  console.log('User ID:', data.user?.id);
  console.log('Session active:', data.session ? 'Yes (Email confirmation disabled)' : 'No (Email confirmation enabled)');

  const user = data.user;
  const session = data.session;

  if (user) {
    console.log('\n--- 2. Checking if profile is synced to public.users ---');
    // Try to fetch profile
    const { data: profile, error: fetchErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Error fetching profile:', fetchErr.message);
    }

    if (!profile) {
      console.log('Profile is missing in public.users (trigger failed or disabled). Attempting client-side fallback insertion...');
      
      const emailPrefix = testEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const username = `${emailPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;

      // Try inserting profile
      // Note: If email confirmation is enabled, our client is not authenticated (session is null)
      // and RLS insert policy check (auth.uid() = id) will fail unless we are authenticated or the DB has no RLS.
      // Let's see what happens.
      const { error: insertErr } = await supabase
        .from('users')
        .insert({
          id: user.id,
          full_name: testFullName,
          username: username,
          email: testEmail,
          avatar_url: null
        });

      if (insertErr) {
        console.error('Client-side fallback insertion failed:', insertErr.message);
        console.log('Note: If email confirmation is enabled, anonymous users cannot write to profiles due to RLS.');
      } else {
        console.log('Client-side fallback insertion succeeded!');
        
        // Seed goals
        const { error: goalErr } = await supabase
          .from('reading_goals')
          .insert({
            user_id: user.id,
            daily_goal: 30,
            monthly_goal: 1,
            yearly_goal: 12
          });

        if (goalErr) {
          console.error('Reading goals seeding failed:', goalErr.message);
        } else {
          console.log('Reading goals seeding succeeded!');
        }
      }
    } else {
      console.log('Profile is already present in public.users (DB trigger succeeded!):', profile);
      
      // Let's verify reading goals table as well
      const { data: goals, error: goalsErr } = await supabase
        .from('reading_goals')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (goalsErr) {
        console.warn('Error fetching goals:', goalsErr.message);
      } else {
        console.log('Reading goals linked successfully (DB trigger seeded!):', goals);
      }
    }
  }
}

runTest().catch(console.error);
