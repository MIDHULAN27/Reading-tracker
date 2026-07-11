-- =======================================================
-- BOOKLYN - IDEMPOTENT SUPABASE MIGRATION SCRIPT
-- Safe to run multiple times. Uses IF NOT EXISTS guards.
-- 
-- HOW TO USE:
--   1. Go to your Supabase Dashboard → SQL Editor → New Query
--   2. Paste this entire file
--   3. Click "Run"
-- =======================================================

-- Enable UUID extension (idempotent)
create extension if not exists "uuid-ossp";


-- =======================================================
-- 1. USERS TABLE
-- =======================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Booklyn Reader',
  username text unique not null,
  email text unique not null,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.users enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'Allow authenticated users to insert their own profile') then
    create policy "Allow authenticated users to insert their own profile" on public.users
      for insert with check (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'Allow authenticated users to read their own profile') then
    create policy "Allow authenticated users to read their own profile" on public.users
      for select using (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'Allow users to update their own profile') then
    create policy "Allow users to update their own profile" on public.users
      for update using (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'Allow public read access to profiles') then
    create policy "Allow public read access to profiles" on public.users
      for select using (true);
  end if;
end $$;


-- =======================================================
-- 2. BOOKS TABLE (Catalog of all books searched/imported)
-- =======================================================
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  openlibrary_id text unique,
  googlebooks_id text unique,
  title text not null,
  author text not null,
  cover_url text,
  cover_color text,
  description text,
  genres text[] default '{}'::text[],
  total_pages integer not null default 0,
  published_year text,
  average_rating numeric default 0.0,
  created_at timestamptz default now() not null
);

alter table public.books enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'books' and policyname = 'Allow anyone to read books catalog') then
    create policy "Allow anyone to read books catalog" on public.books
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'books' and policyname = 'Allow authenticated users to insert books to catalog') then
    create policy "Allow authenticated users to insert books to catalog" on public.books
      for insert with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'books' and policyname = 'Allow admin/authenticated users to update book details') then
    create policy "Allow admin/authenticated users to update book details" on public.books
      for update using (auth.role() = 'authenticated');
  end if;
end $$;


-- =======================================================
-- 3. USER LIBRARY TABLE (User's bookshelf / reading state)
-- =======================================================
create table if not exists public.user_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null check (status in ('to_read', 'reading', 'currently_reading', 'completed', 'dropped')) default 'to_read',
  title text,
  author text,
  cover_url text,
  progress_percentage numeric not null default 0.0,
  current_page integer not null default 0,
  is_favorite boolean not null default false,
  tracking_mode text not null default 'pages' check (tracking_mode in ('pages', 'chapters')),
  total_chapters integer not null default 20,
  current_chapter integer not null default 0,
  has_pdf boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, book_id)
);

alter table public.user_library enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_library' and policyname = 'Users can read their own library bookshelf') then
    create policy "Users can read their own library bookshelf" on public.user_library
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_library' and policyname = 'Users can insert books into their library') then
    create policy "Users can insert books into their library" on public.user_library
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_library' and policyname = 'Users can update their own library books status/progress') then
    create policy "Users can update their own library books status/progress" on public.user_library
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_library' and policyname = 'Users can remove books from their library') then
    create policy "Users can remove books from their library" on public.user_library
      for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =======================================================
-- 4. REVIEWS TABLE
-- =======================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating numeric not null check (rating >= 0 and rating <= 5),
  review_text text not null,
  helpful_users uuid[] default '{}'::uuid[],
  user_name text,
  user_avatar_color text,
  verified boolean not null default false,
  created_at timestamptz default now() not null,
  unique (user_id, book_id)
);

alter table public.reviews enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'Allow anyone to read reviews') then
    create policy "Allow anyone to read reviews" on public.reviews
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'Allow authenticated users to create reviews') then
    create policy "Allow authenticated users to create reviews" on public.reviews
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'Allow authors to edit their reviews') then
    create policy "Allow authors to edit their reviews" on public.reviews
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'Allow authors to delete their reviews') then
    create policy "Allow authors to delete their reviews" on public.reviews
      for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =======================================================
-- 5. READING GOALS TABLE
-- =======================================================
create table if not exists public.reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  yearly_goal integer not null default 12,
  monthly_goal integer not null default 1,
  daily_goal integer not null default 30,
  updated_at timestamptz default now() not null
);

alter table public.reading_goals enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_goals' and policyname = 'Users can view their own goals') then
    create policy "Users can view their own goals" on public.reading_goals
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_goals' and policyname = 'Users can create their goals') then
    create policy "Users can create their goals" on public.reading_goals
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_goals' and policyname = 'Users can update their goals') then
    create policy "Users can update their goals" on public.reading_goals
      for update using (auth.uid() = user_id);
  end if;
end $$;


-- =======================================================
-- 6. READING SESSIONS TABLE (Reading logs)
-- =======================================================
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  pages_read integer not null default 0 check (pages_read >= 0),
  reading_time integer not null default 0 check (reading_time >= 0),
  notes text default '',
  session_date timestamptz default now() not null
);

alter table public.reading_sessions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_sessions' and policyname = 'Users can view their own reading sessions') then
    create policy "Users can view their own reading sessions" on public.reading_sessions
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_sessions' and policyname = 'Users can record new reading sessions') then
    create policy "Users can record new reading sessions" on public.reading_sessions
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_sessions' and policyname = 'Users can delete their reading sessions') then
    create policy "Users can delete their reading sessions" on public.reading_sessions
      for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =======================================================
-- 7. SAVED PAPERS TABLE
-- =======================================================
create table if not exists public.saved_papers (
  id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  authors text[] default '{}'::text[],
  abstract text,
  citation_count integer default 0,
  pdf_url text,
  year text,
  journal text,
  fields text[] default '{}'::text[],
  bookmarked_at timestamptz default now() not null,
  primary key (id, user_id)
);

alter table public.saved_papers enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'saved_papers' and policyname = 'Users can view their own saved papers') then
    create policy "Users can view their own saved papers" on public.saved_papers
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'saved_papers' and policyname = 'Users can bookmark papers') then
    create policy "Users can bookmark papers" on public.saved_papers
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'saved_papers' and policyname = 'Users can delete bookmarked papers') then
    create policy "Users can delete bookmarked papers" on public.saved_papers
      for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =======================================================
-- 8. READING PROGRESS TABLE
-- =======================================================
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  current_location text not null,
  progress_percentage numeric not null default 0.0,
  updated_at timestamptz default now() not null,
  unique (user_id, book_id)
);

alter table public.reading_progress enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_progress' and policyname = 'Users can view their own reading progress') then
    create policy "Users can view their own reading progress" on public.reading_progress
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_progress' and policyname = 'Users can insert their own reading progress') then
    create policy "Users can insert their own reading progress" on public.reading_progress
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_progress' and policyname = 'Users can update their own reading progress') then
    create policy "Users can update their own reading progress" on public.reading_progress
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reading_progress' and policyname = 'Users can delete their own reading progress') then
    create policy "Users can delete their own reading progress" on public.reading_progress
      for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =======================================================
-- AUTO NEW USER SYNC TRIGGER FROM AUTH.USERS
-- =======================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, full_name, username, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      'Booklyn Reader'
    ),
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Create default reading goals for the new user immediately
  insert into public.reading_goals (user_id, yearly_goal, monthly_goal, daily_goal)
  values (new.id, 12, 1, 30);

  return new;
end;
$$ language plpgsql security definer;

-- Drop and recreate trigger to ensure it's up to date
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =======================================================
-- INDEXES (idempotent — CREATE INDEX IF NOT EXISTS)
-- =======================================================
create index if not exists idx_user_library_user_id on public.user_library(user_id);
create index if not exists idx_user_library_book_id on public.user_library(book_id);
create index if not exists idx_reading_sessions_user_id on public.reading_sessions(user_id);
create index if not exists idx_reading_sessions_book_id on public.reading_sessions(book_id);
create index if not exists idx_reviews_book_id on public.reviews(book_id);
create index if not exists idx_saved_papers_user_id on public.saved_papers(user_id);
create index if not exists idx_reading_progress_user_id_book_id on public.reading_progress(user_id, book_id);


-- =======================================================
-- DONE! All 8 tables, RLS policies, indexes, and triggers
-- have been created or verified.
-- =======================================================
select 'Migration completed successfully! All Booklyn tables are ready.' as status;
