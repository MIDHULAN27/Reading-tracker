import { supabase, isSupabaseConfigured } from './supabaseClient';
import { isTableMissingError } from './tableValidator';

// Shared live connection monitoring states
let connectionStatus = isSupabaseConfigured ? 'Pending Validation' : 'Unconfigured';
let connectionError = isSupabaseConfigured ? null : 'Supabase URL/Anon Key is unconfigured in your .env file.';

// Helper to handle DB operations safely with:
// 1. Automatic single-retry for transient network errors
// 2. Direct propagation of database errors (no intercepts or fallbacks)
const safeDbCall = async (operationName, queryFn, fallbackValue, isMutation = false) => {
  let attempt = 0;
  const maxAttempts = 2;
  let delay = 1500;

  while (attempt < maxAttempts) {
    try {
      return await queryFn();
    } catch (err) {
      // Check if we can retry (transient error)
      const isTransient = (error) => {
        if (!error) return false;
        const msg = (error.message || error.toString()).toLowerCase();
        const code = String(error.code || '');
        return (
          code === 'PGRST301' || // JWT expired
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('timeout') ||
          msg.includes('abort') ||
          code === '429' ||
          code.startsWith('5')
        );
      };

      if (attempt < maxAttempts - 1 && isTransient(err)) {
        console.warn(`[Booklyn DB] Transient error in '${operationName}' (${err.message || err}). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        delay *= 2;
        continue;
      }

      // If not transient, or we exhausted retries, throw
      console.error(`[Booklyn DB] Error in '${operationName}':`, err);
      throw err;
    }
  }
};

// Helper to resolve physical book UUID from dynamic Gutenberg (numeric) or Google (gb-*) IDs
const getUuidForBook = async (bookId) => {
  if (!bookId) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(bookId)) {
    return bookId;
  }
  
  const isGoogle = String(bookId).startsWith('gb-');
  const googlebooks_id = isGoogle ? String(bookId).replace('gb-', '') : null;
  const openlibrary_id = !isGoogle ? String(bookId) : null;
  
  let query = supabase.from('books').select('id');
  if (googlebooks_id) {
    query = query.eq('googlebooks_id', googlebooks_id);
  } else if (openlibrary_id) {
    query = query.eq('openlibrary_id', openlibrary_id);
  } else {
    return null;
  }
  
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }
  return data.id;
};

// Helper to handle async operations with clean try-catch wrapping
const executeQuery = async (promise) => {
  try {
    const response = await promise;
    if (response.error) {
      throw response.error;
    }
    return response.data;
  } catch (error) {
    console.error('Booklyn Supabase Error:', error);
    throw new Error(error.message || 'A database error occurred.');
  }
};

export const dbService = {
  // Mode Info (strict production Supabase backend, no sandbox fallbacks)
  isSandboxMode: () => false,
  
  verifyConnection: async () => {
    if (!isSupabaseConfigured) {
      connectionStatus = 'Unconfigured';
      connectionError = 'Supabase URL/Anon Key is unconfigured in your .env file.';
      return false;
    }
    try {
      connectionStatus = 'Testing Connection';
      
      // Lightweight probe query with timeout protection to prevent indefinite hangs
      const probePromise = supabase
        .from('users')
        .select('count', { count: 'exact', head: true });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection probe timed out after 10s.')), 10000)
      );
      
      const { error } = await Promise.race([probePromise, timeoutPromise]);
      
      if (error) throw error;
      
      connectionStatus = 'Connected';
      connectionError = null;
      console.info('[Booklyn Dev] Live PostgreSQL Connection Verified Successfully.');
      return true;
    } catch (err) {
      connectionStatus = 'Disconnected';
      connectionError = err.message || 'Failed to connect to database.';
      console.warn('[Booklyn Dev] PostgreSQL Connection Failed:', err.message);
      return false;
    }
  },

  getConnectionDetails: () => {
    return {
      mode: 'supabase',
      status: connectionStatus,
      error: connectionError,
      url: import.meta.env.VITE_SUPABASE_URL || 'Unconfigured'
    };
  },

  // ==========================
  // AUTH OPERATIONS
  // ==========================
  auth: {
    signUp: async (email, password, fullName = '') => {
      console.log('[Booklyn Auth Debug] Initiating signUp request:', { email, fullName });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            full_name: fullName 
          }
        }
      });
      
      if (error) {
        console.error('[Booklyn Auth Debug] Supabase signUp failed:', error.message);
        throw error;
      }
      
      console.log('[Booklyn Auth Debug] Supabase signUp response:', data);
      
      const user = data.user;
      const session = data.session;
      
      if (user) {
        try {
          console.log('[Booklyn Auth Debug] Checking if user profile exists in public.users for ID:', user.id);
          
          const { data: existingProfile, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
            
          if (fetchError) {
            console.warn('[Booklyn Auth Debug] Error querying existing user profile:', fetchError.message);
          }
          
          if (!existingProfile) {
            console.log('[Booklyn Auth Debug] User profile not found in public.users. Running client-side fallback insert...');
            const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
            const username = `${emailPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;
            
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                full_name: fullName || 'Booklyn Reader',
                username: username,
                email: email,
                avatar_url: null
              });
              
            if (insertError) {
              console.error('[Booklyn Auth Debug] Client-side fallback insert failed (possible triggers handling or RLS restrictions):', insertError.message);
            } else {
              console.log('[Booklyn Auth Debug] Client-side fallback insert succeeded.');
              
              // Seed reading goals as well
              const { error: goalError } = await supabase
                .from('reading_goals')
                .insert({ 
                  user_id: user.id, 
                  daily_goal: 30, 
                  monthly_goal: 1, 
                  yearly_goal: 12 
                });
                
              if (goalError) {
                console.error('[Booklyn Auth Debug] Client-side seeding of reading goals failed:', goalError.message);
              } else {
                console.log('[Booklyn Auth Debug] Client-side reading goals seeding succeeded.');
              }
            }
          } else {
            console.log('[Booklyn Auth Debug] User profile already exists in public.users (inserted by DB trigger).');
          }
        } catch (syncErr) {
          console.error('[Booklyn Auth Debug] Exceptional error in client-side profile sync:', syncErr.message);
        }
      }
      
      return {
        user,
        session
      };
    },

    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return {
        user: data.user,
        session: data.session
      };
    },

    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    getCurrentUser: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      return user;
    },

    // Anonymous guest sign-in with autogenerated fallback for seamless trial
    guestLogin: async () => {
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return {
          user: data.user,
          session: data.session
        };
      } catch (err) {
        console.warn('Anonymous login disabled or failed. Creating autogenerated guest credentials:', err.message);
        
        const guestEmail = `guest-${Math.random().toString(36).substr(2, 9)}@booklynreads.com`;
        const guestPassword = `GuestPassword!${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        const { data, error } = await supabase.auth.signUp({
          email: guestEmail,
          password: guestPassword,
          options: {
            data: { full_name: 'Booklyn Guest' }
          }
        });
        if (error) throw error;
        return {
          user: data.user,
          session: data.session
        };
      }
    },

    signInWithGoogle: async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      return data;
    },

    resetPasswordForEmail: async (email) => {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings`
      });
      if (error) throw error;
      return { success: true, email };
    },

    updateUserPassword: async (newPassword) => {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return { success: true };
    }
  },

  // ==========================
  // BOOK LIBRARY OPERATIONS
  // ==========================
  books: {
    // Maps database tables join back to React-compatible flat book object
    _mapJoinedBook: (libraryEntry, bookCatalog) => {
      return {
        id: bookCatalog.id, // Relies on stable catalog ID
        library_entry_id: libraryEntry.id,
        openlibrary_id: bookCatalog.openlibrary_id,
        googlebooks_id: bookCatalog.googlebooks_id,
        title: bookCatalog.title,
        author: bookCatalog.author,
        cover_url: bookCatalog.cover_url,
        cover_color: bookCatalog.cover_color || 'from-indigo-600 to-indigo-950',
        description: bookCatalog.description || '',
        genre: bookCatalog.genres && bookCatalog.genres.length > 0 ? bookCatalog.genres[0] : 'Fiction',
        genres: bookCatalog.genres || [],
        pages: bookCatalog.total_pages,
        published_year: bookCatalog.published_year || 'Classic',
        average_rating: Number(bookCatalog.average_rating) || 0.0,
        status: libraryEntry.status === 'currently_reading' ? 'reading' : libraryEntry.status,
        progress: libraryEntry.current_page, // current_page represents visual 'progress'
        progress_percentage: Number(libraryEntry.progress_percentage) || 0.0,
        favorite: libraryEntry.is_favorite,
        tracking_mode: libraryEntry.tracking_mode,
        total_chapters: libraryEntry.total_chapters,
        current_chapter: libraryEntry.current_chapter,
        has_pdf: libraryEntry.has_pdf,
        added_at: libraryEntry.started_at || libraryEntry.updated_at,
        last_read: libraryEntry.updated_at
      };
    },

    getBooks: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      return safeDbCall('getBooks', async () => {
        const { data, error } = await supabase
          .from('user_library')
          .select(`
            id,
            status,
            progress_percentage,
            current_page,
            is_favorite,
            tracking_mode,
            total_chapters,
            current_chapter,
            has_pdf,
            started_at,
            completed_at,
            updated_at,
            books (
              id,
              openlibrary_id,
              googlebooks_id,
              title,
              author,
              cover_url,
              cover_color,
              description,
              genres,
              total_pages,
              published_year,
              average_rating
            )
          `)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        if (!data) return [];

        return data
          .filter(item => item.books !== null) // Filter out orphaned entries if any
          .map(item => dbService.books._mapJoinedBook(item, item.books));
      }, []);
    },

    addBook: async (bookData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Validation checks before proceeding
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      if (!bookData || !bookData.id || !bookData.title) {
        throw new Error('Book data missing');
      }

      const book = bookData;
      console.log("Current User:", user);
      console.log("Book:", book);
      console.log("Book ID:", book.id);
      console.log("Book Title:", book.title);

      return safeDbCall('addBook', async () => {
        // Check external ID matches
        const isGoogle = String(bookData.id || '').startsWith('gb-');
        const googlebooks_id = isGoogle ? String(bookData.id).replace('gb-', '') : null;
        const openlibrary_id = !isGoogle && !String(bookData.id || '').startsWith('pdf-') && !String(bookData.id || '').startsWith('book-') ? String(bookData.id) : null;

        // Ensure user profile exists in public.users to prevent FK issues
        const { data: userProfile } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (!userProfile) {
          console.warn('[Booklyn DB] User profile not found in public.users. Seeding profile dynamically...');
          const emailPrefix = (user.email || 'user').split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
          const username = `${emailPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;
          
          const { error: userInsertErr } = await supabase
            .from('users')
            .insert({
              id: user.id,
              full_name: user.user_metadata?.full_name || 'Booklyn Reader',
              username,
              email: user.email || `${user.id}@placeholder.com`,
            });
          
          if (userInsertErr) {
            console.error('[Booklyn DB] User profile auto-seed failed:', userInsertErr.message);
            throw userInsertErr;
          }
            
          const { error: goalInsertErr } = await supabase
            .from('reading_goals')
            .insert({ user_id: user.id, daily_goal: 30, monthly_goal: 1, yearly_goal: 12 });

          if (goalInsertErr) {
            console.error('[Booklyn DB] Reading goals auto-seed failed:', goalInsertErr.message);
          }
        }

        // 1. Search if catalog book already exists
        let catalogBook = null;
        let catalogQuery = supabase.from('books').select('*');
        if (googlebooks_id) {
          catalogQuery = catalogQuery.eq('googlebooks_id', googlebooks_id);
        } else if (openlibrary_id) {
          catalogQuery = catalogQuery.eq('openlibrary_id', openlibrary_id);
        } else {
          catalogQuery = catalogQuery.eq('title', bookData.title).eq('author', bookData.author);
        }

        const { data: matchedBooks, error: catFetchError } = await catalogQuery;
        if (catFetchError) {
          console.error("Catalog Fetch Error:", catFetchError);
          throw catFetchError;
        }

        if (matchedBooks && matchedBooks.length > 0) {
          catalogBook = matchedBooks[0];
        } else {
          // Create catalog entry
          const genresArray = Array.isArray(bookData.genres) 
            ? bookData.genres 
            : bookData.genre ? [bookData.genre] : ['Fiction'];

          const { data: newBook, error: insertErr } = await supabase
            .from('books')
            .insert([{
              title: bookData.title,
              author: bookData.author || 'Unknown Author',
              cover_url: bookData.cover_url || '',
              cover_color: bookData.cover_color || 'from-indigo-600 to-indigo-950',
              description: bookData.description || '',
              genres: genresArray,
              total_pages: Number(bookData.pages) || Number(bookData.total_pages) || 250,
              published_year: String(bookData.published_year || bookData.publish_year || 'Classic'),
              average_rating: Number(bookData.average_rating || bookData.ratings_average) || 0.0,
              googlebooks_id,
              openlibrary_id
            }])
            .select()
            .single();

          if (insertErr) {
            console.error("Book Catalog Insert Error:", insertErr);
            throw insertErr;
          }
          catalogBook = newBook;
        }

        // 2. Check if already associated with library shelf
        const { data: existingLibrary, error: libFetchErr } = await supabase
          .from('user_library')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', catalogBook.id)
          .maybeSingle();

        if (libFetchErr) {
          console.error("Library Fetch Error:", libFetchErr);
          throw libFetchErr;
        }

        // 3. Add or update user library shelf via insert / update
        const totalPages = catalogBook.total_pages;
        const initialProgress = Number(bookData.progress) || 0;
        const progressPct = totalPages > 0 ? (initialProgress / totalPages) * 100 : 0.0;
        const status = bookData.status || (initialProgress >= totalPages && totalPages > 0 ? 'completed' : initialProgress > 0 ? 'reading' : 'to_read');

        let data = null;
        let error = null;

        const isReadNow = status === 'reading' || status === 'currently_reading';

        if (isReadNow) {
          if (existingLibrary) {
            // If book already exists: update status = 'currently_reading'
            console.log("Book already exists. Updating status to 'currently_reading'...");
            const response = await supabase
              .from('user_library')
              .update({
                status: 'currently_reading',
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
              .eq('book_id', catalogBook.id)
              .select();

            data = response.data;
            error = response.error;
          } else {
            // If not: create row and then update status
            console.log("Book does not exist in library. Creating row and then updating status...");
            const insertPayload = {
              user_id: user.id,
              book_id: catalogBook.id,
              title: catalogBook.title,
              author: catalogBook.author,
              cover_url: catalogBook.cover_url,
              status: 'to_read',
              current_page: 0,
              progress_percentage: 0.0,
              is_favorite: false,
              tracking_mode: 'pages',
              total_chapters: 20,
              current_chapter: 0,
              has_pdf: false,
              started_at: null,
              completed_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const insertRes = await supabase
              .from('user_library')
              .insert([insertPayload])
              .select();

            console.log("Insert Response Error:", insertRes.error);
            console.log("Insert Response Data:", insertRes.data);

            if (insertRes.error) {
              throw insertRes.error;
            }

            // Then update status
            const updateRes = await supabase
              .from('user_library')
              .update({
                status: 'currently_reading',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
              .eq('book_id', catalogBook.id)
              .select();

            data = updateRes.data;
            error = updateRes.error;
          }
        } else {
          // General status flow (e.g. Want to Read)
          if (existingLibrary) {
            console.log("Book already exists. Updating existing library row...");
            const response = await supabase
              .from('user_library')
              .update({
                status: status,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
              .eq('book_id', catalogBook.id)
              .select();

            data = response.data;
            error = response.error;
          } else {
            console.log("Book does not exist in library. Inserting new library row...");
            const insertPayload = {
              user_id: user.id,
              book_id: catalogBook.id,
              title: catalogBook.title,
              author: catalogBook.author,
              cover_url: catalogBook.cover_url,
              status: status,
              current_page: initialProgress,
              progress_percentage: progressPct,
              is_favorite: bookData.favorite || false,
              tracking_mode: bookData.tracking_mode || 'pages',
              total_chapters: Number(bookData.total_chapters) || 20,
              current_chapter: Number(bookData.current_chapter) || 0,
              has_pdf: bookData.has_pdf || false,
              started_at: status === 'reading' || status === 'currently_reading' || status === 'completed' ? new Date().toISOString() : null,
              completed_at: status === 'completed' ? new Date().toISOString() : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const response = await supabase
              .from('user_library')
              .insert([insertPayload])
              .select();

            data = response.data;
            error = response.error;
          }
        }

        console.log(error);
        console.log(data);

        if (error) {
          console.error("Library Query Error:", error);
          throw error;
        }

        // Return mapped single item from list response
        const libraryEntry = Array.isArray(data) ? data[0] : data;
        if (!libraryEntry) {
          throw new Error('Failed to retrieve user library record.');
        }

        return dbService.books._mapJoinedBook(libraryEntry, catalogBook);
      }, null, true);
    },

    updateBook: async (bookId, updates) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('updateBook', async () => {
        const libraryUpdates = {};
        if (updates.status !== undefined) {
          libraryUpdates.status = updates.status === 'reading' ? 'currently_reading' : updates.status;
          if (updates.status === 'reading' || updates.status === 'currently_reading') {
            libraryUpdates.started_at = new Date().toISOString();
          } else if (updates.status === 'completed') {
            libraryUpdates.completed_at = new Date().toISOString();
          }
        }
        if (updates.progress !== undefined) {
          libraryUpdates.current_page = Number(updates.progress);
        }
        if (updates.favorite !== undefined) {
          libraryUpdates.is_favorite = updates.favorite;
        }
        if (updates.tracking_mode !== undefined) {
          libraryUpdates.tracking_mode = updates.tracking_mode;
        }
        if (updates.total_chapters !== undefined) {
          libraryUpdates.total_chapters = Number(updates.total_chapters);
        }
        if (updates.current_chapter !== undefined) {
          libraryUpdates.current_chapter = Number(updates.current_chapter);
        }
        if (updates.has_pdf !== undefined) {
          libraryUpdates.has_pdf = updates.has_pdf;
        }

        // Re-calculate progress metrics if page bounds exist
        if (updates.progress !== undefined || updates.pages !== undefined) {
          let totalPages = updates.pages;
          if (!totalPages) {
            const { data: b, error: bookErr } = await supabase.from('books').select('total_pages').eq('id', bookId).single();
            if (bookErr) throw bookErr;
            totalPages = b?.total_pages || 250;
          }
          const progressVal = updates.progress !== undefined ? Number(updates.progress) : 0;
          libraryUpdates.progress_percentage = totalPages > 0 ? Math.min(100, (progressVal / totalPages) * 100) : 0.0;
          
          // Auto mark complete if pages read hits upper bound
          if (progressVal >= totalPages && totalPages > 0) {
            libraryUpdates.status = 'completed';
            libraryUpdates.completed_at = new Date().toISOString();
          }
        }

        libraryUpdates.updated_at = new Date().toISOString();

        const { data: updatedEntry, error } = await supabase
          .from('user_library')
          .update(libraryUpdates)
          .eq('user_id', user.id)
          .eq('book_id', bookId)
          .select()
          .single();

        if (error) throw error;

        const { data: catalogBook, error: catalogErr } = await supabase
          .from('books')
          .select('*')
          .eq('id', bookId)
          .single();
        if (catalogErr) throw catalogErr;

        return dbService.books._mapJoinedBook(updatedEntry, catalogBook);
      }, null, true);
    },

    deleteBook: async (bookId) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('deleteBook', async () => {
        const { error } = await supabase
          .from('user_library')
          .delete()
          .eq('user_id', user.id)
          .eq('book_id', bookId);

        if (error) throw error;
        return true;
      }, false, true);
    }
  },

  // ==========================
  // READING SESSIONS OPERATIONS
  // ==========================
  logs: {
    getLogs: async (bookId = null) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      return safeDbCall('getLogs', async () => {
        let query = supabase
          .from('reading_sessions')
          .select(`
            id,
            book_id,
            pages_read,
            reading_time,
            notes,
            session_date,
            books (
              title,
              author
            )
          `)
          .eq('user_id', user.id);

        if (bookId) {
          const resolvedUuid = await getUuidForBook(bookId);
          if (!resolvedUuid) return [];
          query = query.eq('book_id', resolvedUuid);
        }

        const { data, error } = await query.order('session_date', { ascending: false });
        if (error) throw error;

        return data.map(session => ({
          id: session.id,
          book_id: session.book_id,
          duration_minutes: session.reading_time,
          pages_read: session.pages_read,
          notes: session.notes,
          created_at: session.session_date,
          books: {
            title: session.books?.title || 'Unknown Book',
            author: session.books?.author || 'Unknown Author'
          }
        }));
      }, []);
    },

    addLog: async (logData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('addLog', async () => {
        // 1. Record session entry
        const { data: newSession, error } = await supabase
          .from('reading_sessions')
          .insert([{
            user_id: user.id,
            book_id: logData.book_id,
            pages_read: Number(logData.pages_read),
            reading_time: Number(logData.duration_minutes),
            notes: logData.notes || '',
            session_date: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;

        // 2. Cascade update target library bookshelf metrics
        const { data: lib, error: libErr } = await supabase
          .from('user_library')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', logData.book_id)
          .maybeSingle();

        if (libErr) throw libErr;

        if (lib) {
          const { data: b, error: bookErr } = await supabase.from('books').select('total_pages').eq('id', logData.book_id).single();
          if (bookErr) throw bookErr;
          const totalPages = b?.total_pages || 250;
          
          const nextProgress = Math.min(totalPages, lib.current_page + Number(logData.pages_read));
          const isCompleted = nextProgress >= totalPages;
          const progressPct = totalPages > 0 ? (nextProgress / totalPages) * 100 : 0.0;
          
          const totalChapters = lib.total_chapters || 20;
          const currentChapter = Math.min(totalChapters, Math.round((nextProgress / totalPages) * totalChapters));

          const updates = {
            current_page: nextProgress,
            progress_percentage: progressPct,
            current_chapter: currentChapter,
            updated_at: new Date().toISOString()
          };

          if (isCompleted) {
            updates.status = 'completed';
            updates.completed_at = new Date().toISOString();
          } else if (lib.status === 'to_read') {
            updates.status = 'reading';
            updates.started_at = new Date().toISOString();
          }

          const { error: updateErr } = await supabase
            .from('user_library')
            .update(updates)
            .eq('user_id', user.id)
            .eq('book_id', logData.book_id);
          if (updateErr) throw updateErr;
        }

        return {
          id: newSession.id,
          book_id: newSession.book_id,
          duration_minutes: newSession.reading_time,
          pages_read: newSession.pages_read,
          notes: newSession.notes,
          created_at: newSession.session_date
        };
      }, null, true);
    },

    deleteLog: async (logId) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('deleteLog', async () => {
        const { error } = await supabase
          .from('reading_sessions')
          .delete()
          .eq('id', logId);

        if (error) throw error;
        return true;
      }, false, true);
    }
  },

  // ==========================
  // BOOK REVIEWS OPERATIONS
  // ==========================
  reviews: {
    getReviews: async (bookId, sortBy = 'helpful', page = 1, limit = 5) => {
      return safeDbCall('getReviews', async () => {
        const resolvedUuid = await getUuidForBook(bookId);
        if (!resolvedUuid) {
          return { reviews: [], hasMore: false, totalCount: 0 };
        }
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('book_id', resolvedUuid);

        if (error) throw error;
        if (!data) return { reviews: [], hasMore: false, totalCount: 0 };

        // Re-sort results dynamically in JS to spread helpful reacts robustly
        const sortedData = [...data];
        if (sortBy === 'helpful') {
          sortedData.sort((a, b) => (b.helpful_users?.length || 0) - (a.helpful_users?.length || 0));
        } else {
          sortedData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        const startIndex = (page - 1) * limit;
        const paginated = sortedData.slice(startIndex, startIndex + limit);
        const hasMore = sortedData.length > startIndex + limit;

        return {
          reviews: paginated.map(r => ({
            id: r.id,
            book_id: r.book_id,
            user_id: r.user_id,
            user_name: r.user_name || 'Anonymous Reader',
            user_avatar_color: r.user_avatar_color || 'bg-indigo-500',
            rating: Number(r.rating),
            review_text: r.review_text,
            helpful_users: r.helpful_users || [],
            created_at: r.created_at,
            verified: r.verified
          })),
          hasMore,
          totalCount: sortedData.length
        };
      }, { reviews: [], hasMore: false, totalCount: 0 });
    },

    addReview: async (reviewData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('addReview', async () => {
        const userName = user.user_metadata?.full_name || user.email || 'Anonymous Reader';
        const colors = ['bg-amber-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-pink-500', 'bg-purple-500', 'bg-sky-500'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const { data: newReview, error } = await supabase
          .from('reviews')
          .insert([{
            user_id: user.id,
            book_id: reviewData.book_id,
            rating: Number(reviewData.rating),
            review_text: reviewData.review_text,
            user_name: userName,
            user_avatar_color: randomColor,
            verified: reviewData.verified || false
          }])
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('You have already submitted a review for this book.');
          }
          throw error;
        }

        return {
          id: newReview.id,
          book_id: newReview.book_id,
          user_id: newReview.user_id,
          user_name: newReview.user_name,
          user_avatar_color: newReview.user_avatar_color,
          rating: Number(newReview.rating),
          review_text: newReview.review_text,
          helpful_users: newReview.helpful_users || [],
          created_at: newReview.created_at,
          verified: newReview.verified
        };
      }, null, true);
    },

    updateReview: async (reviewId, updates) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('updateReview', async () => {
        const { data: updated, error } = await supabase
          .from('reviews')
          .update({
            rating: Number(updates.rating),
            review_text: updates.review_text
          })
          .eq('id', reviewId)
          .select()
          .single();

        if (error) throw error;
        return updated;
      }, null, true);
    },

    deleteReview: async (reviewId) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('deleteReview', async () => {
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', reviewId);

        if (error) throw error;
        return true;
      }, false, true);
    },

    toggleHelpful: async (reviewId, userId) => {
      return safeDbCall('toggleHelpful', async () => {
        const { data: review, error } = await supabase
          .from('reviews')
          .select('helpful_users')
          .eq('id', reviewId)
          .single();

        if (error) throw error;

        let helpfulUsers = review.helpful_users || [];
        if (helpfulUsers.includes(userId)) {
          helpfulUsers = helpfulUsers.filter(id => id !== userId);
        } else {
          helpfulUsers.push(userId);
        }

        const { data: updated, error: updateErr } = await supabase
          .from('reviews')
          .update({ helpful_users: helpfulUsers })
          .eq('id', reviewId)
          .select()
          .single();

        if (updateErr) throw updateErr;
        return updated;
      }, null, true);
    }
  },

  // ==========================
  // RESEARCH PAPERS OPERATIONS
  // ==========================
  papers: {
    getPapers: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      return safeDbCall('getPapers', async () => {
        const { data, error } = await supabase
          .from('saved_papers')
          .select('*')
          .eq('user_id', user.id)
          .order('bookmarked_at', { ascending: false });

        if (error) throw error;
        return data;
      }, []);
    },

    bookmarkPaper: async (paperData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('bookmarkPaper', async () => {
        const { data: saved, error } = await supabase
          .from('saved_papers')
          .insert([{
            id: String(paperData.id),
            user_id: user.id,
            title: paperData.title,
            authors: paperData.authors || ['Unknown Scholar'],
            abstract: paperData.abstract || '',
            citation_count: Number(paperData.citationCount) || 0,
            pdf_url: paperData.pdf_url || null,
            year: String(paperData.year || 'Unknown'),
            journal: paperData.journal || 'Academic Research Journal',
            fields: paperData.fields || ['Science']
          }])
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            const { data, error: fetchErr } = await supabase
              .from('saved_papers')
              .select('*')
              .eq('id', String(paperData.id))
              .eq('user_id', user.id)
              .single();
            if (fetchErr) throw fetchErr;
            return data;
          }
          throw error;
        }
        return saved;
      }, null, true);
    },

    unbookmarkPaper: async (paperId) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('unbookmarkPaper', async () => {
        const { error } = await supabase
          .from('saved_papers')
          .delete()
          .eq('id', paperId)
          .eq('user_id', user.id);

        if (error) throw error;
        return true;
      }, false, true);
    }
  },

  // ==========================
  // GOALS OPERATIONS
  // ==========================
  goals: {
    getGoals: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { daily_goal: 30, monthly_goal: 1, yearly_goal: 12 };

      return safeDbCall('getGoals', async () => {
        const { data, error } = await supabase
          .from('reading_goals')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          // Auto seed goal entry
          const { data: seeded, error: seedErr } = await supabase
            .from('reading_goals')
            .insert([{ user_id: user.id, daily_goal: 30, monthly_goal: 1, yearly_goal: 12 }])
            .select()
            .single();
            
          if (seedErr) {
            console.warn('Could not auto-seed goals table', seedErr.message);
            return { daily_goal: 30, monthly_goal: 1, yearly_goal: 12 };
          }
          return seeded;
        }

        return data;
      }, { daily_goal: 30, monthly_goal: 1, yearly_goal: 12 });
    },

    updateGoals: async (updates) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('updateGoals', async () => {
        const mappedUpdates = {};
        if (updates.daily_goal !== undefined) mappedUpdates.daily_goal = Number(updates.daily_goal);
        if (updates.monthly_goal !== undefined) mappedUpdates.monthly_goal = Number(updates.monthly_goal);
        if (updates.yearly_goal !== undefined) mappedUpdates.yearly_goal = Number(updates.yearly_goal);
        mappedUpdates.updated_at = new Date().toISOString();

        const { data: updated, error } = await supabase
          .from('reading_goals')
          .update(mappedUpdates)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      }, null, true);
    }
  },

  // ==========================
  // PROGRESS SYNC OPERATIONS
  // ==========================
  progress: {
    getProgress: async (bookId) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      return safeDbCall('getProgress', async () => {
        const resolvedUuid = await getUuidForBook(bookId);
        if (!resolvedUuid) return null;
        const { data, error } = await supabase
          .from('reading_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', resolvedUuid)
          .maybeSingle();

        if (error) throw error;
        return data;
      }, null);
    },

    saveProgress: async (bookId, currentLocation, progressPercentage) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      return safeDbCall('saveProgress', async () => {
        const resolvedUuid = await getUuidForBook(bookId);
        if (!resolvedUuid) {
          throw new Error('Book not found in database');
        }

        // Check if progress entry already exists
        const { data: existingProgress, error: fetchError } = await supabase
          .from('reading_progress')
          .select('id')
          .eq('user_id', user.id)
          .eq('book_id', resolvedUuid)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingProgress) {
          const { data, error } = await supabase
            .from('reading_progress')
            .update({
              current_location: String(currentLocation),
              progress_percentage: Number(progressPercentage),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProgress.id)
            .select()
            .single();

          if (error) throw error;
          return data;
        } else {
          const { data, error } = await supabase
            .from('reading_progress')
            .insert([{
              user_id: user.id,
              book_id: resolvedUuid,
              current_location: String(currentLocation),
              progress_percentage: Number(progressPercentage)
            }])
            .select()
            .single();

          if (error) throw error;
          return data;
        }
      }, null, true);
    }
  }
};
