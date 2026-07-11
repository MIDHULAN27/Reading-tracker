-- =======================================================
-- BOOKLYN READS - POSTGRESQL & SUPABASE DATABASE SCHEMA
-- =======================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Booklyn Reader',
  username text unique not null,
  email text unique not null,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS on users
alter table public.users enable row level security;

-- Users policies
create policy "Allow authenticated users to insert their own profile" on public.users
  for insert with check (auth.uid() = id);

create policy "Allow authenticated users to read their own profile" on public.users
  for select using (auth.uid() = id);

create policy "Allow users to update their own profile" on public.users
  for update using (auth.uid() = id);

create policy "Allow public read access to profiles" on public.users
  for select using (true);

-- 2. BOOKS TABLE (Catalog of all books searched/imported)
create table public.books (
  id uuid primary key default gen_random_uuid(),
  openlibrary_id text unique,
  googlebooks_id text unique,
  title text not null,
  author text not null,
  cover_url text,
  cover_color text, -- Custom UI gradient string
  description text,
  genres text[] default '{}'::text[],
  total_pages integer not null default 0,
  published_year text,
  average_rating numeric default 0.0,
  created_at timestamptz default now() not null
);

-- Enable RLS on books catalog
alter table public.books enable row level security;

-- Books policies
create policy "Allow anyone to read books catalog" on public.books
  for select using (true);

create policy "Allow authenticated users to insert books to catalog" on public.books
  for insert with check (auth.role() = 'authenticated');

create policy "Allow admin/authenticated users to update book details" on public.books
  for update using (auth.role() = 'authenticated');

-- 3. USER LIBRARY TABLE (User's bookshelf / reading state)
create table public.user_library (
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

-- Enable RLS on user library
alter table public.user_library enable row level security;

-- User Library policies
create policy "Users can read their own library bookshelf" on public.user_library
  for select using (auth.uid() = user_id);

create policy "Users can insert books into their library" on public.user_library
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own library books status/progress" on public.user_library
  for update using (auth.uid() = user_id);

create policy "Users can remove books from their library" on public.user_library
  for delete using (auth.uid() = user_id);

-- 4. REVIEWS TABLE
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating numeric not null check (rating >= 0 and rating <= 5),
  review_text text not null,
  helpful_users uuid[] default '{}'::uuid[], -- List of user IDs who found it helpful
  user_name text, -- Cache name for performance
  user_avatar_color text, -- Cache avatar style
  verified boolean not null default false,
  created_at timestamptz default now() not null,
  unique (user_id, book_id) -- Only one review per book per user
);

-- Enable RLS on reviews
alter table public.reviews enable row level security;

-- Reviews policies
create policy "Allow anyone to read reviews" on public.reviews
  for select using (true);

create policy "Allow authenticated users to create reviews" on public.reviews
  for insert with check (auth.uid() = user_id);

create policy "Allow authors to edit their reviews" on public.reviews
  for update using (auth.uid() = user_id);

create policy "Allow authors to delete their reviews" on public.reviews
  for delete using (auth.uid() = user_id);

-- 5. READING GOALS TABLE
create table public.reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  yearly_goal integer not null default 12,
  monthly_goal integer not null default 1,
  daily_goal integer not null default 30, -- In minutes
  updated_at timestamptz default now() not null
);

-- Enable RLS on reading goals
alter table public.reading_goals enable row level security;

-- Reading Goals policies
create policy "Users can view their own goals" on public.reading_goals
  for select using (auth.uid() = user_id);

create policy "Users can create their goals" on public.reading_goals
  for insert with check (auth.uid() = user_id);

create policy "Users can update their goals" on public.reading_goals
  for update using (auth.uid() = user_id);

-- 6. READING SESSIONS TABLE (Reading logs)
create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  pages_read integer not null default 0 check (pages_read >= 0),
  reading_time integer not null default 0 check (reading_time >= 0), -- in minutes
  notes text default '',
  session_date timestamptz default now() not null
);

-- Enable RLS on reading sessions
alter table public.reading_sessions enable row level security;

-- Reading Sessions policies
create policy "Users can view their own reading sessions" on public.reading_sessions
  for select using (auth.uid() = user_id);

create policy "Users can record new reading sessions" on public.reading_sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their reading sessions" on public.reading_sessions
  for delete using (auth.uid() = user_id);

-- 7. SAVED PAPERS TABLE
create table public.saved_papers (
  id text not null, -- Semantic Scholar paper ID or DOI string
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

-- Enable RLS on saved papers
alter table public.saved_papers enable row level security;

-- Saved papers policies
create policy "Users can view their own saved papers" on public.saved_papers
  for select using (auth.uid() = user_id);

create policy "Users can bookmark papers" on public.saved_papers
  for insert with check (auth.uid() = user_id);

create policy "Users can delete bookmarked papers" on public.saved_papers
  for delete using (auth.uid() = user_id);


-- =======================================================
-- AUTOMATIC NEW USER SYNC TRIGGER FROM AUTH.USERS
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

-- Trigger to sync auth users to public users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =======================================================
-- OPTIMIZED INDEXES FOR HIGH-PERFORMANCE QUERYING
-- =======================================================
create index idx_user_library_user_id on public.user_library(user_id);
create index idx_user_library_book_id on public.user_library(book_id);
create index idx_reading_sessions_user_id on public.reading_sessions(user_id);
create index idx_reading_sessions_book_id on public.reading_sessions(book_id);
create index idx_reviews_book_id on public.reviews(book_id);
create index idx_saved_papers_user_id on public.saved_papers(user_id);

-- =======================================================
-- 8. READING PROGRESS TABLE (Syncing precise EPUB CFI or PDF page number cross-device)
-- =======================================================
create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  current_location text not null, -- Stores EPUB CFI (e.g. 'epubcfi(...)') or PDF page number (e.g. '12')
  progress_percentage numeric not null default 0.0,
  updated_at timestamptz default now() not null,
  unique (user_id, book_id)
);

-- Enable RLS
alter table public.reading_progress enable row level security;

-- Policies
create policy "Users can view their own reading progress" on public.reading_progress
  for select using (auth.uid() = user_id);

create policy "Users can insert their own reading progress" on public.reading_progress
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own reading progress" on public.reading_progress
  for update using (auth.uid() = user_id);

create policy "Users can delete their own reading progress" on public.reading_progress
  for delete using (auth.uid() = user_id);

-- Index for high-performance retrieval of reading progress
create index idx_reading_progress_user_id_book_id on public.reading_progress(user_id, book_id);
