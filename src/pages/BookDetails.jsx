import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Book, FileText, Calendar, Plus, Check, Star, Heart, Bookmark, 
  ExternalLink, RefreshCw, AlertCircle, ThumbsUp, Trash2, Edit2, 
  MessageSquare, CheckCircle, Clock, ChevronLeft, ArrowRight, Play, Pause, BookmarkCheck,
  Volume2, VolumeX, Music, Sparkles
} from 'lucide-react';
import { booksApi } from '../api/booksApi';
import { useLibraryStore } from '../store/useLibraryStore';
import { useProgressStore } from '../store/useProgressStore';
import { useReviewStore } from '../store/useReviewStore';
import { useAuthStore } from '../store/useAuthStore';
import RatingPicker from '../components/RatingPicker';
import LogSessionModal from '../components/LogSessionModal';
import { pdfStore } from '../services/pdfStore';
import { triggerConfetti } from '../utils/confetti';
import Reader from '../components/Reader';
import { useGuestGuard } from '../hooks/useGuestGuard';

// ==========================================
// WEB AUDIO API SANCTUARY SOUND SYNTHESIZER
// ==========================================
const createNoiseBuffer = (ctx, duration = 2) => {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

const createNoiseSource = (ctx, buffer) => {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
};

const createBrownNoiseBuffer = (ctx, duration = 2) => {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5; // Gain compensation
  }
  return buffer;
};

const triggerCrackle = (ctx, destination) => {
  const buffer = createNoiseBuffer(ctx, 0.05);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 8000;
  const gain = ctx.createGain();
  gain.gain.value = Math.random() * 0.12 + 0.01;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(0);
};

export default function BookDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { books, addBook, updateBook, deleteBook, fetchBooks } = useLibraryStore();
  const { logs, fetchLogs, addLog } = useProgressStore();
  const { user, initialized: authInitialized, loading: authLoading } = useAuthStore();
  const guard = useGuestGuard();
  const currentUserId = user?.id || 'guest-booklyn-reader';

  // Detail states
  const [bookDetails, setBookDetails] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Local shelve settings
  const [updatingShelf, setUpdatingShelf] = useState(false);
  const [trackMode, setTrackMode] = useState('pages');
  const [totalChapters, setTotalChapters] = useState(20);

  // Reviews states
  const { 
    reviews, 
    loading: reviewsLoading, 
    error: reviewsError, 
    page, 
    hasMore, 
    totalCount, 
    sortBy, 
    fetchReviews, 
    submitReview, 
    editReview, 
    removeReview, 
    toggleReaction 
  } = useReviewStore();

  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(0);
  
  // Local premium toast state
  const [localToast, setLocalToast] = useState(null);
  const showLocalToast = (message, type = 'success') => {
    setLocalToast({ message, type });
    setTimeout(() => {
      setLocalToast(null);
    }, 4000);
  };

  // Progress Timer store links
  const { 
    timerActive, timerSeconds, timerBookId, 
    startTimer, pauseTimer, resetTimer, updateTimerSeconds 
  } = useProgressStore();

  // Find if book already exists in local shelf
  const existingBook = books.find(b => 
    b.id === id || 
    (b.openlibrary_id && String(b.openlibrary_id) === String(id)) || 
    (b.googlebooks_id && `gb-${b.googlebooks_id}` === id)
  );

  // ==========================================
  // VIRTUAL READING SANCTUARY STATES & LOGIC
  // ==========================================
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isReaderModeActive, setIsReaderModeActive] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');

  // Audio synthesiser state
  const [isRainPlaying, setIsRainPlaying] = useState(false);
  const [isFirePlaying, setIsFirePlaying] = useState(false);
  const [isWindPlaying, setIsWindPlaying] = useState(false);
  const [rainVolume, setRainVolume] = useState(0.5);
  const [fireVolume, setFireVolume] = useState(0.5);
  const [windVolume, setWindVolume] = useState(0.5);

  const audioContextRef = useRef(null);
  const rainSource = useRef(null);
  const rainGain = useRef(null);
  const fireSource = useRef(null);
  const fireGain = useRef(null);
  const fireInterval = useRef(null);
  const windSource = useRef(null);
  const windLfo = useRef(null);
  const windGain = useRef(null);

  // Initialize local progress when existingBook loads
  useEffect(() => {
    if (existingBook) {
      setLocalProgress(existingBook.progress || 0);
    }
  }, [existingBook?.progress]);

  // Load PDF Blob URL
  useEffect(() => {
    let active = true;
    let generatedUrl = null;
    
    if (existingBook?.has_pdf) {
      pdfStore.getPDF(existingBook.id)
        .then(blob => {
          if (active && blob) {
            generatedUrl = URL.createObjectURL(blob);
            setPdfUrl(generatedUrl);
          }
        })
        .catch(err => console.error('Failed to load PDF binary:', err));
    }
    
    return () => {
      active = false;
      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [existingBook?.id, existingBook?.has_pdf]);

  // Cleanup sound nodes on unmount
  useEffect(() => {
    return () => {
      if (rainSource.current) {
        try { rainSource.current.stop(); } catch (e) {}
      }
      if (fireSource.current) {
        try { fireSource.current.stop(); } catch (e) {}
      }
      if (fireInterval.current) {
        clearTimeout(fireInterval.current);
      }
      if (windSource.current) {
        try { windSource.current.stop(); } catch (e) {}
      }
      if (windLfo.current) {
        try { windLfo.current.stop(); } catch (e) {}
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  const handleRainVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setRainVolume(val);
    if (rainGain.current && audioContextRef.current) {
      rainGain.current.gain.setValueAtTime(val, audioContextRef.current.currentTime);
    }
  };

  const handleFireVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setFireVolume(val);
    if (fireGain.current && audioContextRef.current) {
      fireGain.current.gain.setValueAtTime(val * 0.8, audioContextRef.current.currentTime);
    }
  };

  const handleWindVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setWindVolume(val);
    if (windGain.current && audioContextRef.current) {
      windGain.current.gain.setValueAtTime(val, audioContextRef.current.currentTime);
    }
  };

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const toggleRain = () => {
    try {
      initAudioContext();
      const ctx = audioContextRef.current;

      if (isRainPlaying) {
        if (rainSource.current) {
          rainSource.current.stop();
          rainSource.current.disconnect();
          rainSource.current = null;
        }
        setIsRainPlaying(false);
      } else {
        const buffer = createNoiseBuffer(ctx, 2);
        const source = createNoiseSource(ctx, buffer);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gain = ctx.createGain();
        gain.gain.value = rainVolume;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start(0);
        rainSource.current = source;
        rainGain.current = gain;
        setIsRainPlaying(true);
      }
    } catch (err) {
      console.error('Rain synth failed:', err);
    }
  };

  const toggleFire = () => {
    try {
      initAudioContext();
      const ctx = audioContextRef.current;

      if (isFirePlaying) {
        if (fireSource.current) {
          fireSource.current.stop();
          fireSource.current.disconnect();
          fireSource.current = null;
        }
        if (fireInterval.current) {
          clearTimeout(fireInterval.current);
          fireInterval.current = null;
        }
        setIsFirePlaying(false);
      } else {
        const rumbleBuffer = createBrownNoiseBuffer(ctx, 2);
        const rumbleSource = createNoiseSource(ctx, rumbleBuffer);
        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.value = 180;

        const rumbleGain = ctx.createGain();
        rumbleGain.gain.value = fireVolume * 0.8;

        rumbleSource.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(ctx.destination);
        rumbleSource.start(0);

        fireSource.current = rumbleSource;
        fireGain.current = rumbleGain;

        const crackleGain = ctx.createGain();
        crackleGain.gain.value = fireVolume;
        crackleGain.connect(ctx.destination);

        const playCrackle = () => {
          const delay = Math.random() * 200 + 40;
          fireInterval.current = setTimeout(() => {
            if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
            triggerCrackle(ctx, crackleGain);
            playCrackle();
          }, delay);
        };
        playCrackle();

        setIsFirePlaying(true);
      }
    } catch (err) {
      console.error('Fire synth failed:', err);
    }
  };

  const toggleWind = () => {
    try {
      initAudioContext();
      const ctx = audioContextRef.current;

      if (isWindPlaying) {
        if (windSource.current) {
          windSource.current.stop();
          windSource.current.disconnect();
          windSource.current = null;
        }
        if (windLfo.current) {
          windLfo.current.stop();
          windLfo.current.disconnect();
          windLfo.current = null;
        }
        setIsWindPlaying(false);
      } else {
        const buffer = createBrownNoiseBuffer(ctx, 3);
        const source = createNoiseSource(ctx, buffer);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 450;
        filter.Q.value = 2.5;

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 180;

        const gain = ctx.createGain();
        gain.gain.value = windVolume;

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        lfo.start(0);
        source.start(0);

        windSource.current = source;
        windLfo.current = lfo;
        windGain.current = gain;
        setIsWindPlaying(true);
      }
    } catch (err) {
      console.error('Wind synth failed:', err);
    }
  };

  const handleSanctuaryLog = async () => {
    if (!existingBook) return;

    if (localProgress < existingBook.progress) {
      alert(`Progress cannot go backwards. Current database page is ${existingBook.progress}.`);
      return;
    }

    const durationMins = Math.max(1, Math.round(timerSeconds / 60));
    const pagesAdvanced = localProgress - existingBook.progress;

    try {
      await addLog({
        book_id: existingBook.id,
        duration_minutes: durationMins,
        pages_read: pagesAdvanced,
        notes: sessionNotes
      });

      const nextProgress = localProgress;
      const totalChapters = existingBook.total_chapters || 20;
      const currentChapter = Math.min(totalChapters, Math.round((nextProgress / existingBook.pages) * totalChapters));
      const completed = nextProgress >= existingBook.pages;

      await updateBook(existingBook.id, {
        progress: nextProgress,
        current_chapter: currentChapter,
        status: completed ? 'completed' : 'reading'
      });

      if (completed) {
        triggerConfetti();
        alert(`🎉 Congratulations! You have fully completed "${existingBook.title}"!`);
      } else {
        alert('Your sanctuary reading session has been synced and logged successfully!');
      }

      resetTimer();
      setSessionNotes('');
      setIsReaderModeActive(false);
      fetchLogs(id);
    } catch (err) {
      console.error('Failed to log sanctuary session:', err);
      alert('Could not sync progress to the database. Please try again.');
    }
  };

  // Fetch book details & library shelf sync WITH TIMEOUT PROTECTION
  useEffect(() => {
    let active = true;
    let timeoutId = null;
    
    // Don't start loading until auth has been initialized.
    // On page refresh, Supabase takes time to restore the session.
    // If we call getBooks() before auth is ready, getUser() returns null
    // and the library comes back empty, making UUID books unfindable.
    if (!authInitialized) {
      setLoading(true);
      return;
    }
    
    async function loadBookData() {
      setLoading(true);
      setError('');
      
      console.log('[BookDetails] ===== BOOK LOAD START =====');
      console.log('[BookDetails] Route ID:', id);
      console.log('[BookDetails] Auth initialized:', authInitialized, '| User:', user?.id || 'guest');
      
      // Helper: check if this is a UUID (Supabase library book ID)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      console.log('[BookDetails] ID format:', isUUID ? 'UUID (library book)' : 'External (Gutenberg/GB)');
      
      try {
        // Set a 30-second timeout to give fetchBooks() + retry time to complete
        timeoutId = setTimeout(() => {
          if (active) {
            console.error('[BookDetails] ⏱️ TIMEOUT after 30 seconds - book fetch never completed');
            setError('Book details took too long to load. Please try again.');
            setLoading(false);
          }
        }, 30000);
        
        // Step 1: Check cached books first (instant)
        const cachedBooks = useLibraryStore.getState().books;
        let targetBook = cachedBooks.find(b => 
          b.id === id || 
          (b.openlibrary_id && String(b.openlibrary_id) === String(id)) || 
          (b.googlebooks_id && `gb-${b.googlebooks_id}` === id)
        );
        
        if (targetBook) {
          console.log('[BookDetails] ✅ Found in cached library:', targetBook.title);
        } else {
          // Step 2: Fetch latest from Supabase
          console.log('[BookDetails] Not in cache, fetching library books from database...');
          await fetchBooks();
          
          const currentBooks = useLibraryStore.getState().books;
          console.log('[BookDetails] Library has', currentBooks.length, 'books');
          
          targetBook = currentBooks.find(b => {
            const matches = b.id === id || 
              (b.openlibrary_id && String(b.openlibrary_id) === String(id)) || 
              (b.googlebooks_id && `gb-${b.googlebooks_id}` === id);
            if (matches) {
              console.log('[BookDetails] Found in library by ID:', b.id, 'vs', id);
            }
            return matches;
          });
          
          console.log('[BookDetails] Library search result:', !!targetBook, targetBook?.title);
        }
        
        // Step 3: If still not found
        if (!targetBook) {
          if (isUUID) {
            // UUID not found in library - this book was deleted or belongs to different account
            console.error('[BookDetails] UUID not found in library:', id);
            setError('This book could not be found in your library. It may have been removed.');
            setLoading(false);
            if (timeoutId) clearTimeout(timeoutId);
            return;
          }
          
          // For external IDs (Gutenberg/Google), fetch from catalog
          console.log('[BookDetails] Step 3: Book not in library, fetching from external catalog...');
          try {
            targetBook = await booksApi.getBook(id);
            console.log('[BookDetails] ✅ API returned book:', targetBook?.title, targetBook?.id);
          } catch (err) {
            console.error('[BookDetails] ❌ API fetch failed:', err.message);
            console.log('[BookDetails] Creating fallback book object for ID:', id);
            targetBook = {
              id: id,
              title: id.replace(/[-_]+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              author: 'Unknown Author',
              cover_url: '',
              cover_color: 'from-amber-600 to-amber-950',
              pages: 250,
              genre: 'Fiction',
              publish_year: 'Classic',
              publisher: 'Project Gutenberg',
              language: 'English',
              ratings_average: 4.2,
              source: 'Fallback (Error Loading)'
            };
          }
        } else {
          // Found in library - load progress configurations
          console.log('[BookDetails] Step 3: Book found in library, loading configurations...');
          setTrackMode(targetBook.tracking_mode || 'pages');
          setTotalChapters(targetBook.total_chapters || 20);
          console.log('[BookDetails] Tracking mode:', targetBook.tracking_mode);
        }

        if (active) {
          if (targetBook) {
            console.log('[BookDetails] Step 4: Setting book details...');
            setBookDetails(targetBook);
            console.log('[BookDetails] ✅ Book details set:', targetBook.title);
            
            // Fetch description separately using correct external API ID
            const externalId = targetBook.googlebooks_id 
              ? `gb-${targetBook.googlebooks_id}` 
              : (targetBook.openlibrary_id || targetBook.id);
            
            // Skip description fetch for UUIDs (no external catalog entry)
            if (!isUUID || targetBook.openlibrary_id || targetBook.googlebooks_id) {
              console.log('[BookDetails] Step 5: Fetching description for external ID:', externalId);
              try {
                const desc = await booksApi.getBookDescription(externalId);
                setDescription(desc || 'A classical masterpiece curated for your reading sanctuary.');
                console.log('[BookDetails] ✅ Description loaded');
              } catch (descErr) {
                console.warn('[BookDetails] Description fetch failed, using default:', descErr.message);
                setDescription('A classical masterpiece curated for your reading sanctuary.');
              }
            } else {
              setDescription('A book from your personal reading library.');
            }
          } else {
            console.error('[BookDetails] ❌ No targetBook available');
            setError('Could not locate book catalog details.');
          }
        }
      } catch (err) {
        if (active) {
          console.error('[BookDetails] ❌ UNEXPECTED ERROR:', err.message, err.stack);
          setError(err.message || 'Failed to fetch detailed book catalog data.');
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (active) {
          setLoading(false);
          console.log('[BookDetails] ===== BOOK LOAD COMPLETE =====');
        }
      }
    }

    loadBookData();
    fetchReviews(id, 'helpful', 1, false);
    fetchLogs(id);

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  // authInitialized is critical: ensures we re-run once auth session is restored after page refresh
  }, [id, authInitialized, fetchBooks, fetchReviews, fetchLogs]);

  // Sync timers
  useEffect(() => {
    let interval = null;
    if (timerActive && timerBookId === id) {
      interval = setInterval(() => {
        updateTimerSeconds();
      }, 500);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerBookId, id, updateTimerSeconds]);

  // Handle adding book to library shelf
  const handleAddToLibrary = async (shelf = 'to_read') => {
    if (!user || !user.id || guard('Add to Library')) {
      showLocalToast('User not authenticated', 'error');
      return;
    }
    if (!bookDetails || !bookDetails.id) {
      showLocalToast('Book data missing', 'error');
      return;
    }

    const isFreeBook = bookDetails && !(bookDetails.googlebooks_id && !bookDetails.openlibrary_id && !bookDetails.has_pdf);
    if (!isFreeBook) {
      showLocalToast('Only free edition books (from Project Gutenberg or local uploads) can be added to your library.', 'error');
      return;
    }

    setUpdatingShelf(true);
    try {
      await addBook({
        ...bookDetails,
        status: shelf,
        progress: 0,
        rating: 0,
        review: '',
        tracking_mode: 'pages',
        total_chapters: 20,
        current_chapter: 0
      });
      // Sync local shelves
      await fetchBooks();
      
      if (shelf === 'to_read') {
        showLocalToast('✓ Added to Want To Read', 'success');
      } else {
        showLocalToast('✓ Book added to library', 'success');
      }
      
      if (shelf === 'reading') {
        navigate(`/read/${id}`, { state: { fromBookDetails: true } });
      }
    } catch (err) {
      console.error(err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('user not authenticated') || msg.includes('auth') || msg.includes('authenticated') || msg.includes('sign in') || msg.includes('jwt') || msg.includes('login')) {
        showLocalToast('User not authenticated', 'error');
      } else if (msg.includes('book data missing')) {
        showLocalToast('Book data missing', 'error');
      } else {
        showLocalToast(err.message || 'Failed to add book', 'error');
      }
    } finally {
      setUpdatingShelf(false);
    }
  };

  // Handle shelf status dropdown modifications
  const handleShelfChange = async (e) => {
    if (!user || !user.id || guard('Change Shelf')) {
      showLocalToast('User not authenticated', 'error');
      return;
    }
    const newStatus = e.target.value;
    if (!existingBook) {
      showLocalToast('Book data missing', 'error');
      return;
    }
    
    setUpdatingShelf(true);
    try {
      if (newStatus === 'none') {
        if (confirm('Remove this book and all its associated logs from your library?')) {
          await deleteBook(existingBook.id);
          showLocalToast(`Removed "${existingBook.title}" from your library.`, 'info');
          navigate('/library');
        }
      } else {
        await updateBook(existingBook.id, { status: newStatus });
        if (newStatus === 'to_read') {
          showLocalToast('✓ Added to Want To Read', 'success');
        } else {
          showLocalToast('✓ Book added to library', 'success');
        }
        
        if (newStatus === 'reading') {
          navigate(`/read/${id}`, { state: { fromBookDetails: true } });
        }
      }
    } catch (err) {
      console.error(err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('user not authenticated') || msg.includes('auth') || msg.includes('authenticated') || msg.includes('sign in') || msg.includes('jwt') || msg.includes('login')) {
        showLocalToast('User not authenticated', 'error');
      } else {
        showLocalToast(err.message || 'Failed to update book status', 'error');
      }
    } finally {
      setUpdatingShelf(false);
    }
  };

  // Toggle favorite flag
  const toggleFavorite = async () => {
    if (guard('Favorites')) {
      showLocalToast('✗ User not authenticated', 'error');
      return;
    }
    if (!existingBook) return;
    try {
      await updateBook(existingBook.id, { favorite: !existingBook.favorite });
    } catch (err) {
      console.error(err);
    }
  };

  // Update chapter details
  const handleChapterConfigSubmit = async (e) => {
    e.preventDefault();
    if (guard('Configure Tracking')) {
      showLocalToast('✗ User not authenticated', 'error');
      return;
    }
    if (!existingBook) return;
    try {
      await updateBook(existingBook.id, {
        tracking_mode: trackMode,
        total_chapters: Number(totalChapters),
        current_chapter: Math.min(Number(totalChapters), existingBook.current_chapter || 0)
      });
      alert('Configured tracking units updated successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  // Reviews handlers
  const handleSortChange = (newSort) => {
    fetchReviews(id, newSort, 1, false);
  };

  const handleLoadMore = () => {
    fetchReviews(id, sortBy, page + 1, true);
  };

  const handleReviewSubmit = async () => {
    if (guard('Write Reviews')) {
      showLocalToast('✗ User not authenticated', 'error');
      return;
    }
    setSubmittingReview(true);
    setSubmitError(null);
    try {
      // Check if user already reviewed
      const hasReviewed = reviews.some(r => r.user_id === currentUserId);
      if (hasReviewed) {
        throw new Error('You have already submitted a review for this book.');
      }
      await submitReview(id, newReviewRating, newReviewText, true);
      setNewReviewText('');
      setNewReviewRating(0);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev.id);
    setEditText(rev.review_text);
    setEditRating(rev.rating);
  };

  const handleReviewEditSave = async (reviewId) => {
    try {
      await editReview(reviewId, editRating, editText);
      setEditingReviewId(null);
    } catch (err) {
      alert(err.message || 'Failed to save edits.');
    }
  };

  const handleReviewDelete = async (reviewId) => {
    if (confirm('Are you sure you want to delete your community review?')) {
      try {
        await removeReview(reviewId);
      } catch (err) {
        alert(err.message || 'Failed to delete review.');
      }
    }
  };

  const handleHelpfulToggle = async (reviewId) => {
    if (guard('React to Reviews')) {
      showLocalToast('✗ User not authenticated', 'error');
      return;
    }
    try {
      await toggleReaction(reviewId);
    } catch (err) {
      console.error(err);
    }
  };

  // Timer controllers
  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${hrs > 0 ? hrs + ':' : ''}${pad(mins)}:${pad(secs)}`;
  };

  const startReadingSessionTimer = () => {
    if (guard('Reading Timer')) {
      showLocalToast('✗ User not authenticated', 'error');
      return;
    }
    if (!existingBook) return;
    startTimer(existingBook.id);
    showLocalToast('✓ Reading session started', 'success');
  };

  const handleStopTimer = () => {
    pauseTimer();
    setIsLogModalOpen(true);
  };

  const handleLogModalClose = () => {
    setIsLogModalOpen(false);
    resetTimer();
    fetchLogs(id);
  };

  // Math metrics
  const progressPct = existingBook ? Math.round((existingBook.progress / existingBook.pages) * 100) : 0;
  const isTimerRunningOnThisBook = timerActive && timerBookId === id;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-booklyn-amber animate-spin" />
        <p className="font-serif italic text-sm text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
          Loading detailed book profile...
        </p>
      </div>
    );
  }

  if (error || !bookDetails) {
    const handleRetry = () => {
      console.log('[BookDetails] User clicked retry - reloading page');
      window.location.reload();
    };
    
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Link to="/discover" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 hover:text-booklyn-amber dark:hover:text-booklyn-amber-light">
          <ChevronLeft className="w-4 h-4" /> Back to Discover
        </Link>
        <div className="p-8 text-center glass-panel border border-red-500/20 rounded-3xl space-y-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto opacity-70" />
          <div className="space-y-3">
            <h3 className="font-serif text-2xl font-bold">Catalog Load Error</h3>
            <p className="text-sm max-w-md mx-auto text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
              {error || 'The book metadata could not be fetched or resolved from catalog records.'}
            </p>
            <div className="text-xs text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 font-mono bg-black/10 dark:bg-white/5 p-2 rounded max-w-sm mx-auto">
              <p>Book ID: <span className="text-booklyn-amber font-bold">{id}</span></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={handleRetry} className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs active:scale-95 transition-all flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <button onClick={() => navigate('/discover')} className="px-6 py-2.5 rounded-xl bg-booklyn-amber hover:brightness-110 text-white font-semibold text-xs active:scale-95 transition-all">
              Browse Discover Feed
            </button>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="relative min-h-screen pb-16">
      {/* Ambient background glowing particles */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] rounded-full ambient-glow-2 pointer-events-none" />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Back Link */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 hover:text-booklyn-night-300 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Go Back
          </button>
          
          {existingBook && (
            <button 
              onClick={toggleFavorite}
              className={`p-2.5 rounded-xl border transition-all ${
                existingBook.favorite 
                  ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-sm'
                  : 'bg-white/20 dark:bg-white/5 border-white/20 dark:border-white/10 hover:text-red-500'
              }`}
            >
              <Heart className={`w-5 h-5 ${existingBook.favorite ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* 1. Header Banner Panel (Glassmorphic) */}
        <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
          
          {/* Glowing Background Spotlight */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-booklyn-amber/5 blur-3xl pointer-events-none" />

          {/* Cover Art Box */}
          <div className="w-full md:w-48 flex-shrink-0 flex justify-center">
            {bookDetails.cover_url ? (
              <div className="relative group">
                <img 
                  src={bookDetails.cover_url} 
                  alt={bookDetails.title}
                  className="w-40 sm:w-44 rounded-2xl shadow-xl border border-white/10 object-cover transform transition-all group-hover:scale-105 group-hover:rotate-1 duration-300"
                />
                <div className="absolute inset-0 rounded-2xl bg-black/10 dark:bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ) : (
              <div className={`w-40 h-56 rounded-2xl bg-gradient-to-tr ${bookDetails.cover_color} text-white shadow-xl flex flex-col items-center justify-between p-4 border border-white/15 text-center`}>
                <Book className="w-8 h-8 opacity-60 mt-4" />
                <h4 className="font-serif font-bold text-sm tracking-tight line-clamp-3 leading-snug px-1">{bookDetails.title}</h4>
                <p className="text-[10px] uppercase font-bold tracking-wider opacity-75 truncate max-w-full mb-2">{bookDetails.author}</p>
              </div>
            )}
          </div>

          {/* Book Info Metadata */}
          <div className="flex-1 space-y-5 min-w-0">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-3 py-1 rounded-full bg-booklyn-amber/15 dark:bg-booklyn-amber-light/10 text-booklyn-amber dark:text-booklyn-amber-light text-[10px] font-bold uppercase tracking-widest">
                  {bookDetails.genre || 'Literature'}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/20 dark:bg-white/5 border border-white/10 text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 font-semibold">
                  {bookDetails.source}
                </span>
              </div>
              <h1 className="font-serif font-bold text-3xl sm:text-4xl text-booklyn-night-300 dark:text-white leading-tight">
                {bookDetails.title}
              </h1>
              <p className="font-serif text-lg text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
                by <span className="font-bold underline decoration-booklyn-amber/40">{bookDetails.author}</span>
              </p>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block">Total Pages</span>
                <span className="font-sans font-bold text-lg text-booklyn-night-300 dark:text-white">{bookDetails.pages} pages</span>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block">Publish Year</span>
                <span className="font-sans font-bold text-lg text-booklyn-night-300 dark:text-white">{bookDetails.publish_year}</span>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block">Language</span>
                <span className="font-sans font-bold text-lg text-booklyn-night-300 dark:text-white truncate block">{bookDetails.language || 'English'}</span>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block">Global Rating</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-4 h-4 fill-booklyn-amber text-booklyn-amber" />
                  <span className="font-sans font-bold text-lg text-booklyn-night-300 dark:text-white">
                    {bookDetails.ratings_average ? bookDetails.ratings_average : '4.2'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions (Add to Library vs Shelf Change Dropdown) */}
            <div className="pt-3 border-t border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 flex flex-wrap gap-4 items-center">
              {!existingBook ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 font-medium">Add to shelves:</span>
                  <div className="flex rounded-xl overflow-hidden border border-booklyn-amber/30">
                    <button 
                      onClick={() => handleAddToLibrary('to_read')}
                      disabled={updatingShelf}
                      className="px-4 py-2 bg-booklyn-amber hover:brightness-110 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Want to Read
                    </button>
                    <button 
                      onClick={() => handleAddToLibrary('reading')}
                      disabled={updatingShelf}
                      className="px-4 py-2 bg-booklyn-amber-dark hover:brightness-110 text-white font-semibold text-xs border-l border-white/10 transition-colors flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Read Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 pl-0.5 mb-1">
                      Shelf Status
                    </span>
                    <div className="relative">
                      <select 
                        value={existingBook.status} 
                        onChange={handleShelfChange}
                        disabled={updatingShelf}
                        className="!pr-8 !pl-3 py-2.5 glass-input appearance-none text-xs font-semibold select-none cursor-pointer pr-10 border border-booklyn-amber/25 focus:border-booklyn-amber"
                      >
                        <option value="to_read" className="bg-booklyn-cream-50 dark:bg-booklyn-night-200">📚 Want to Read</option>
                        <option value="reading" className="bg-booklyn-cream-50 dark:bg-booklyn-night-200">📖 Currently Reading</option>
                        <option value="completed" className="bg-booklyn-cream-50 dark:bg-booklyn-night-200">✅ Completed</option>
                        <option value="dropped" className="bg-booklyn-cream-50 dark:bg-booklyn-night-200">🛑 Dropped</option>
                        <option value="none" className="bg-booklyn-cream-50 dark:bg-booklyn-night-200 text-red-500 font-bold">🗑 Remove Book</option>
                      </select>
                      <Check className="w-4 h-4 text-emerald-500 absolute right-8 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {existingBook.status === 'reading' && (
                    <div className="flex items-end h-full pt-4 gap-3 flex-wrap">
                      <button 
                        onClick={() => {
                          if (guard('Reader Sanctuary')) {
                            showLocalToast('✗ User not authenticated', 'error');
                            return;
                          }
                          navigate(`/read/${id}`, { state: { fromBookDetails: true } });
                          startReadingSessionTimer();
                        }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-800 hover:brightness-110 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                      >
                        <Book className="w-3.5 h-3.5" /> Enter Reading Sanctuary
                      </button>
                      {isTimerRunningOnThisBook ? (
                        <button 
                          onClick={handleStopTimer}
                          className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-2 shadow-glow-amber animate-pulse-subtle"
                        >
                          <Pause className="w-3.5 h-3.5 fill-current" /> Stop timer ({formatTime(timerSeconds)})
                        </button>
                      ) : (
                        <button 
                          onClick={startReadingSessionTimer}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white font-bold text-xs flex items-center gap-2"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" /> Start Reading Timer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 2. Grid split: Progress Circle Tracker vs Synopsis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info Area: Synopsis + Progress Logs */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Synopsis Card */}
            <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="font-serif font-bold text-xl text-booklyn-night-300 dark:text-white flex items-center gap-2">
                <Book className="w-5 h-5 text-booklyn-amber" />
                <span>Synopsis & Work Summary</span>
              </h3>
              <div className="font-serif italic text-sm sm:text-base leading-relaxed text-booklyn-night-100/75 dark:text-booklyn-cream-200/70 whitespace-pre-line border-l-2 border-booklyn-amber/20 pl-4 py-1">
                {description || 'No detailed abstract is currently available for this edition work entry.'}
              </div>
            </div>

            {/* Reading Sessions Logs */}
            {existingBook && (
              <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-4">
                <h3 className="font-serif font-bold text-xl text-booklyn-night-300 dark:text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-booklyn-amber" />
                    <span>My Reading Log Sessions</span>
                  </div>
                  <button 
                    onClick={() => {
                      if (guard('Log Reading Session')) return;
                      setIsLogModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-white/20 dark:bg-white/5 border border-white/10 hover:bg-white/30 text-xs font-bold"
                  >
                    + Log Session
                  </button>
                </h3>

                {logs.length === 0 ? (
                  <div className="py-8 text-center space-y-2 border-2 border-dashed border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 rounded-2xl">
                    <Clock className="w-8 h-8 text-booklyn-night-100/30 mx-auto" />
                    <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">No reading sessions have been logged for this book yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-booklyn-amber">{log.duration_minutes} min read</span>
                            <span className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/30">•</span>
                            <span className="font-semibold text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">+{log.pages_read} pages advanced</span>
                          </div>
                          {log.notes && (
                            <p className="text-xs italic text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 font-serif pl-2 border-l border-white/10 mt-1">
                              "{log.notes}"
                            </p>
                          )}
                          <span className="text-[9px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 block">
                            Logged on {new Date(log.created_at).toLocaleDateString()} at {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right Sidebar: Progress Tracker Ring & Configurations */}
          <div className="space-y-8">
            
            {/* Interactive Progress Card */}
            {existingBook ? (
              <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark" />
                
                <h4 className="font-serif font-bold text-lg text-booklyn-night-300 dark:text-white text-left pl-1">
                  Reading Progress
                </h4>

                {/* SVG Progress Ring */}
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Circle Background */}
                    <circle 
                      cx="72" cy="72" r="58"
                      className="stroke-booklyn-cream-300/30 dark:stroke-booklyn-night-100/20"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    {/* Circle Progress */}
                    <motion.circle 
                      cx="72" cy="72" r="58"
                      className="stroke-booklyn-amber"
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 58}
                      strokeDashoffset={2 * Math.PI * 58 * (1 - progressPct / 100)}
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - progressPct / 100) }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </svg>
                  {/* Outer glow ring */}
                  <div className="absolute inset-0 rounded-full border border-booklyn-amber/10 blur-sm pointer-events-none scale-90" />
                  
                  {/* Interior Text */}
                  <div className="absolute flex flex-col items-center">
                    <span className="font-sans font-bold text-3xl tracking-tighter text-booklyn-night-300 dark:text-white">
                      {progressPct}%
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/30">
                      Completed
                    </span>
                  </div>
                </div>

                {/* Progression Details */}
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl space-y-2 border border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Shelf Location</span>
                    <span className="font-semibold capitalize text-booklyn-amber">{existingBook.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Pages Logged</span>
                    <span className="font-semibold text-booklyn-night-300 dark:text-white">{existingBook.progress} / {existingBook.pages} p.</span>
                  </div>
                  
                  {existingBook.tracking_mode === 'chapters' && (
                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                      <span className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">Chapters Read</span>
                      <span className="font-semibold text-booklyn-night-300 dark:text-white">
                        {existingBook.current_chapter || 0} / {existingBook.total_chapters || 20} ch.
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Add Log Trigger */}
                <button 
                  onClick={() => {
                    if (guard('Log Reading Session')) return;
                    setIsLogModalOpen(true);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-booklyn-amber/10 active:scale-98 transition-all"
                >
                  <Plus className="w-4 h-4" /> Log Reading Session
                </button>

              </div>
            ) : (
              <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 text-center space-y-4">
                <BookmarkCheck className="w-12 h-12 text-booklyn-amber/40 mx-auto" />
                <h4 className="font-serif font-bold text-lg text-booklyn-night-300 dark:text-white">Not on Your Shelf</h4>
                <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 leading-relaxed max-w-[220px] mx-auto">
                  Add this book to your Virtual Sanctuary shelves to track logs, measure streaks, and write personal reflections.
                </p>
                <button 
                  onClick={() => handleAddToLibrary('to_read')}
                  disabled={updatingShelf}
                  className="w-full py-2.5 bg-booklyn-amber text-white text-xs font-semibold rounded-xl hover:brightness-110"
                >
                  Add to Want to Read
                </button>
              </div>
            )}

            {/* Tracking Units Customization Card */}
            {existingBook && (
              <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 space-y-4">
                <h4 className="font-serif font-bold text-sm text-booklyn-night-300 dark:text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-booklyn-amber" />
                  <span>Configure Tracking Units</span>
                </h4>
                
                <form onSubmit={handleChapterConfigSubmit} className="space-y-4">
                  {/* Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35">
                      Log Sessions By:
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setTrackMode('pages')}
                        className={`py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase ${
                          trackMode === 'pages'
                            ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white shadow'
                            : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:text-white'
                        }`}
                      >
                        Pages Count
                      </button>
                      <button 
                        type="button"
                        onClick={() => setTrackMode('chapters')}
                        className={`py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase ${
                          trackMode === 'chapters'
                            ? 'bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white shadow'
                            : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:text-white'
                        }`}
                      >
                        Chapters Count
                      </button>
                    </div>
                  </div>

                  {/* Chapters specific counts input */}
                  <AnimatePresence>
                    {trackMode === 'chapters' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1 overflow-hidden"
                      >
                        <label className="text-[9px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35">
                          Total Chapters inside Book:
                        </label>
                        <input 
                          type="number"
                          min="1"
                          required
                          value={totalChapters}
                          onChange={(e) => setTotalChapters(e.target.value)}
                          className="w-full py-2 glass-input text-xs"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    type="submit"
                    className="w-full py-2 bg-white/20 dark:bg-white/5 border border-white/10 hover:bg-white/30 text-xs font-bold rounded-xl transition-all"
                  >
                    Save Configuration
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>

        {/* 3. Community Reviews Section */}
        <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 pb-4 gap-4">
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-xl text-booklyn-night-300 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-booklyn-amber" />
                <span>Verified Community Reviews</span>
              </h3>
              <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
                {totalCount} readers have left ratings and review logs.
              </p>
            </div>

            {/* Sorting pill selection */}
            <div className="flex gap-1.5 bg-black/10 dark:bg-white/5 p-1 rounded-xl">
              <button 
                onClick={() => handleSortChange('helpful')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                  sortBy === 'helpful'
                    ? 'bg-booklyn-amber text-white shadow'
                    : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:text-white'
                }`}
              >
                Most Helpful
              </button>
              <button 
                onClick={() => handleSortChange('recent')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                  sortBy === 'recent'
                    ? 'bg-booklyn-amber text-white shadow'
                    : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 hover:text-white'
                }`}
              >
                Most Recent
              </button>
            </div>
          </div>

          {/* Write a review center */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 space-y-4">
            <h4 className="font-serif font-bold text-sm text-booklyn-night-300 dark:text-white">
              Write your community review
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">My Rating:</span>
                <RatingPicker rating={newReviewRating} onChange={setNewReviewRating} size={5} />
              </div>

              <textarea 
                rows="3"
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                placeholder="Share your structured insights, reviews, or favorite quotes about this volume..."
                className="w-full py-2.5 glass-input text-xs resize-none"
              />

              {submitError && (
                <p className="text-red-500 text-xs font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {submitError}
                </p>
              )}

              <button 
                onClick={handleReviewSubmit}
                disabled={submittingReview || newReviewRating === 0}
                className="px-5 py-2 bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                {submittingReview ? 'Submitting Review...' : 'Publish Review'}
              </button>
            </div>
          </div>

          {/* Reviews List */}
          {reviewsLoading && reviews.length === 0 ? (
            <div className="py-8 text-center">
              <RefreshCw className="w-8 h-8 text-booklyn-amber animate-spin mx-auto" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 rounded-2xl space-y-3">
              <MessageSquare className="w-10 h-10 text-booklyn-night-100/25 mx-auto" />
              <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">No readers have published community reviews for this book yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{rev.user_name || 'Verified Booklyn'}</span>
                        {rev.verified && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified
                          </span>
                        )}
                      </div>
                      <RatingPicker rating={rev.rating} readOnly size={3.5} />
                    </div>
                    
                    <span className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/30">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Editing Mode */}
                  {editingReviewId === rev.id ? (
                    <div className="space-y-3">
                      <RatingPicker rating={editRating} onChange={setEditRating} size={4} />
                      <textarea 
                        rows="3" 
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full glass-input text-xs resize-none"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleReviewEditSave(rev.id)}
                          className="px-3 py-1 bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white rounded-lg text-xs font-bold"
                        >
                          Save Changes
                        </button>
                        <button 
                          onClick={() => setEditingReviewId(null)}
                          className="px-3 py-1 bg-white/15 rounded-lg text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-booklyn-night-100/80 dark:text-booklyn-cream-200/70 font-serif leading-relaxed italic">
                      "{rev.review_text}"
                    </p>
                  )}

                  {/* Review Actions Row */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <button 
                      onClick={() => handleHelpfulToggle(rev.id)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        (rev.helpful_users || []).includes(currentUserId)
                          ? 'text-booklyn-amber'
                          : 'text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 hover:text-booklyn-amber'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 fill-current" />
                      <span>Helpful ({rev.helpful_users?.length || 0})</span>
                    </button>

                    {rev.user_id === currentUserId && (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleStartEdit(rev)}
                          className="text-[10px] uppercase font-bold tracking-wider text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 hover:text-booklyn-amber transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button 
                          onClick={() => handleReviewDelete(rev.id)}
                          className="text-[10px] uppercase font-bold tracking-wider text-red-500/60 dark:text-red-400/50 hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              ))}

              {hasMore && (
                <button 
                  onClick={handleLoadMore}
                  className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-xs font-bold transition-all text-booklyn-night-100/60 dark:text-booklyn-cream-200/50"
                >
                  Load More Reviews
                </button>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Embedded session log modal */}
      <LogSessionModal 
        isOpen={isLogModalOpen} 
        onClose={handleLogModalClose} 
        initialBookId={id} 
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {localToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-xs font-semibold shadow-2xl backdrop-blur-md transition-all ${
              localToast.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : localToast.type === 'info'
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {localToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : localToast.type === 'info' ? (
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{localToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
