import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, Type, Sun, Moon, Sparkles,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Eye, RefreshCw, BookOpen,
  Volume2, VolumeX, Edit3, CheckCircle, Layout, AlertTriangle
} from 'lucide-react';
import { ReactReader } from 'react-reader';
import { Document, Page, pdfjs } from 'react-pdf';
import { useLibraryStore } from '../store/useLibraryStore';
import { booksApi } from '../api/books';
import { pdfStore } from '../services/pdfStore';
import { dbService } from '../services/db';

// Configure the PDF worker using unpkg Dist CDN CDN URL
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Native helper to enforce request and body download timeouts with Promise.race fallback to prevent infinite stream hangs
async function fetchBlobWithTimeout(url, options = {}, msTimeout = 10000) {
  const controller = new AbortController();
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Network timeout of ${msTimeout}ms exceeded.`));
    }, msTimeout);
  });

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      return blob;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

// Utility to download a binary ebook blob routing requests through the Booklyn Express backend proxy endpoint to bypass CORS
async function downloadFromBackend(url) {
  if (!url) throw new Error('Invalid URL provided.');
  
  // Clean URL to absolute format if needed
  let targetUrl = url;
  if (url.startsWith('//')) {
    targetUrl = 'https:' + url;
  }

  const backendUrl = `/api/epub?url=${encodeURIComponent(targetUrl)}`;
  const timeoutMs = 25000; // 25 seconds timeout for backend fetch + stream proxy

  try {
    return await fetchBlobWithTimeout(backendUrl, {}, timeoutMs);
  } catch (err) {
    console.error('[Booklyn Reader] Proxy download failed:', err);
    throw new Error(err.message || 'Booklyn backend or Gutenberg proxy is unreachable.');
  }
}

export default function Reader({ book, onClose, onProgressUpdate }) {
  const { updateBook } = useLibraryStore();
  const [theme, setTheme] = useState(() => localStorage.getItem(`booklyn_theme_${book.id}`) || 'light');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem(`booklyn_font_${book.id}`)) || 100);

  const textColorClass = theme === 'dark' ? '!text-white' : theme === 'sepia' ? '!text-[#433422]' : '!text-slate-800';
  const descColorClass = theme === 'dark' ? '!text-slate-300' : theme === 'sepia' ? '!text-[#5c4a37]' : '!text-slate-600';
  
  // Format URLs and resolution states
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const [activeEpubUrl, setActiveEpubUrl] = useState(book.epub_url || null);
  const [activePdfUrl, setActivePdfUrl] = useState(book.pdf_url || null);
  const [activeHtmlUrl, setActiveHtmlUrl] = useState(book.html_url || null);
  const [activeTextUrl, setActiveTextUrl] = useState(book.text_url || null);
  const [activeOpenLibraryUrl, setActiveOpenLibraryUrl] = useState(book.resolved_url || null);
  const [viewMode, setViewMode] = useState(book.primary_format && book.primary_format !== 'none' ? book.primary_format : 'epub'); // 'epub' | 'pdf' | 'html' | 'text' | 'google-preview' | 'openlibrary'

  // Pre-fetching and loading states to handle IndexedDB and CORS proxies
  const [loadingBook, setLoadingBook] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [localEpubUrl, setLocalEpubUrl] = useState(null);
  const [localPdfUrl, setLocalPdfUrl] = useState(null);
  const [localHtmlUrl, setLocalHtmlUrl] = useState(null);
  const [localTextContent, setLocalTextContent] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [epubRenderFailed, setEpubRenderFailed] = useState(false);

  // EPUB Reader state
  const [epubLocation, setEpubLocation] = useState(() => localStorage.getItem(`booklyn_pos_${book.id}`) || null);
  const renditionRef = useRef(null);

  // PDF Reader state
  const [pdfNumPages, setPdfNumPages] = useState(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(() => Number(localStorage.getItem(`booklyn_pos_${book.id}`)) || 1);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfWidth, setPdfWidth] = useState(600);

  // Reflections journal notes
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Track page size to scale the PDF canvas responsively
  const pdfContainerRef = useRef(null);

  // 0. Synchronise precise position from Supabase reading_progress on mount
  useEffect(() => {
    async function syncProgressFromServer() {
      try {
        console.log('[Booklyn Reader] Checking remote progress for:', book.id);
        const serverProgress = await dbService.progress.getProgress(book.id);
        if (serverProgress && serverProgress.current_location) {
          const loc = serverProgress.current_location;
          console.log('[Booklyn Reader] Restoring precise location from Supabase:', loc);
          
          localStorage.setItem(`booklyn_pos_${book.id}`, loc);
          
          if (viewMode === 'pdf') {
            const pageNum = Number(loc);
            if (!isNaN(pageNum) && pageNum > 0) {
              setPdfPageNumber(pageNum);
            }
          } else {
            setEpubLocation(loc);
            if (renditionRef.current) {
              renditionRef.current.display(loc);
            }
          }
        }
      } catch (err) {
        console.warn('[Booklyn Reader] Failed to restore progress from database:', err);
      }
    }
    
    syncProgressFromServer();
  }, [book.id, viewMode]);

  // 1. Dynamic format resolver on mount
  useEffect(() => {
    async function resolveFormats() {
      if (book.primary_format && book.primary_format !== 'none') {
        if (book.primary_format === 'epub') setActiveEpubUrl(book.epub_url);
        if (book.primary_format === 'pdf') setActivePdfUrl(book.pdf_url);
        if (book.primary_format === 'html') setActiveHtmlUrl(book.html_url);
        if (book.primary_format === 'text') setActiveTextUrl(book.text_url);
        if (book.primary_format === 'openlibrary') setActiveOpenLibraryUrl(book.resolved_url);
        setViewMode(book.primary_format);
        return;
      }

      if (book.epub_url || book.pdf_url || book.html_url || book.text_url || book.has_pdf) {
        setActiveEpubUrl(book.epub_url);
        setActivePdfUrl(book.pdf_url);
        setActiveHtmlUrl(book.html_url);
        setActiveTextUrl(book.text_url);
        let mode = 'epub';
        if (book.has_pdf || book.pdf_url) mode = 'pdf';
        else if (book.epub_url) mode = 'epub';
        else if (book.html_url) mode = 'html';
        else if (book.text_url) mode = 'text';
        setViewMode(mode);
        return;
      }

      setResolving(true);
      setResolveError(null);

      async function tryFallbackServices() {
        const gbVolumeId = String(book.id).startsWith('gb-') ? book.id.replace('gb-', '') : null;
        if (gbVolumeId) {
          setViewMode('google-preview');
          return;
        }
        
        try {
          const searchResp = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(book.title + ' ' + (book.author || ''))}&maxResults=1`
          );
          const searchData = await searchResp.json();
          if (searchData.items && searchData.items.length > 0) {
            const foundId = searchData.items[0].id;
            await updateBook(book.id, { google_volume_id: foundId });
            book.google_volume_id = foundId;
            setViewMode('google-preview');
            return;
          }
        } catch (e) {}

        try {
          const query = `${book.title} ${book.author || ''}`.trim().replace(/\s+/g, '+');
          const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`);
          const data = await res.json();
          if (data.docs && data.docs.length > 0) {
            const doc = data.docs[0];
            if (doc.has_fulltext && doc.key) {
              setActiveOpenLibraryUrl(`https://openlibrary.org${doc.key}/read`);
              setViewMode('openlibrary');
              return;
            }
          }
        } catch (e) {}
        
        console.error('All 5 tiers of reading fallbacks failed.');
        setResolveError('no-source');
      }

      try {
        const result = await booksApi.resolveGutenbergFiles(book.title, book.author);
        if (result) {
          await updateBook(book.id, {
            epub_url: result.epub_url,
            pdf_url: result.pdf_url,
            text_url: result.text_url,
            html_url: result.html_url
          });

          setActiveEpubUrl(result.epub_url);
          setActivePdfUrl(result.pdf_url);
          setActiveHtmlUrl(result.html_url);
          setActiveTextUrl(result.text_url);

          if (result.epub_url) setViewMode('epub');
          else if (result.pdf_url) setViewMode('pdf');
          else if (result.html_url) setViewMode('html');
          else if (result.text_url) setViewMode('text');
          else await tryFallbackServices();
        } else {
          await tryFallbackServices();
        }
      } catch (err) {
        console.error('Ebook resolution error:', err);
        setResolveError('no-source');
      } finally {
        setResolving(false);
      }
    }

    resolveFormats();
  }, [book, updateBook]);

  // Track created object URLs for strict revoking and garbage collection on component destruction
  const createdUrlsRef = useRef([]);

  const createLocalBlobUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    createdUrlsRef.current.push(url);
    return url;
  };

  // Revoke all created URLs when exiting the reader to avoid memory leaks
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('Failed to revoke object URL on clean up:', e);
        }
      });
    };
  }, []);

  // 2. Pre-fetch binary blobs and bypass CORS blockages
  useEffect(() => {
    let active = true;

    async function loadBookData() {
      if (resolving) return; // Wait for URL resolution first

      // Mode A: EPUB
      if (viewMode === 'epub') {
        if (!activeEpubUrl) return;
        if (localEpubUrl) return; // Already downloaded

        setLoadingBook(true);
        setLoadingError(null);

        try {
          const blob = await downloadFromBackend(activeEpubUrl);
          if (!active) return;
          const localUrl = createLocalBlobUrl(blob);
          setLocalEpubUrl(localUrl);
        } catch (err) {
          console.error('Failed to pre-download EPUB:', err);
          if (active) {
            if (activePdfUrl) setViewMode('pdf');
            else if (activeHtmlUrl) setViewMode('html');
            else if (activeTextUrl) setViewMode('text');
            else if (String(book.id).startsWith('gb-') || book.google_volume_id) setViewMode('google-preview');
            else {
              setLoadingError(
                `Could not download this EPUB through the Booklyn proxy server. ` +
                `Reason: ${err.message}. Please try again.`
              );
            }
          }
        } finally {
          if (active) setLoadingBook(false);
        }
      } 
      // Mode B: PDF
      else if (viewMode === 'pdf') {
        if (localPdfUrl) return; // Already loaded

        setLoadingBook(true);
        setLoadingError(null);

        try {
          if (book.has_pdf) {
            // Load local imported PDF from IndexedDB
            const blob = await pdfStore.getPDF(book.id);
            if (!blob) {
              throw new Error('Imported PDF file binary could not be retrieved from the local IndexedDB database.');
            }
            if (!active) return;
            const localUrl = createLocalBlobUrl(blob);
            setLocalPdfUrl(localUrl);
          } else if (activePdfUrl) {
            // Download Gutenberg PDF through the backend proxy
            const blob = await downloadFromBackend(activePdfUrl);
            if (!active) return;
            const localUrl = createLocalBlobUrl(blob);
            setLocalPdfUrl(localUrl);
          } else {
            throw new Error('No PDF format path is available.');
          }
        } catch (err) {
          console.error('Failed to load PDF book content:', err);
          if (active) {
            if (activeHtmlUrl) setViewMode('html');
            else if (activeTextUrl) setViewMode('text');
            else if (String(book.id).startsWith('gb-') || book.google_volume_id) setViewMode('google-preview');
            else {
              setLoadingError(
                book.has_pdf
                  ? `Local PDF retrieval failed: ${err.message}`
                  : `Could not download the Gutenberg PDF through the Booklyn proxy server. Reason: ${err.message}. Please retry.`
              );
            }
          }
        } finally {
          if (active) setLoadingBook(false);
        }
      }
      // Mode C: HTML
      else if (viewMode === 'html') {
        if (!activeHtmlUrl) return;
        if (localHtmlUrl) return;

        setLoadingBook(true);
        setLoadingError(null);

        try {
          const blob = await downloadFromBackend(activeHtmlUrl);
          if (!active) return;
          const localUrl = createLocalBlobUrl(blob);
          setLocalHtmlUrl(localUrl);
        } catch (err) {
          console.error('Failed to pre-download HTML:', err);
          if (active) {
            if (activeTextUrl) setViewMode('text');
            else if (String(book.id).startsWith('gb-') || book.google_volume_id) setViewMode('google-preview');
            else setLoadingError(`HTML download failed: ${err.message}`);
          }
        } finally {
          if (active) setLoadingBook(false);
        }
      }
      // Mode D: Text
      else if (viewMode === 'text') {
        if (!activeTextUrl) return;
        if (localTextContent) return;

        setLoadingBook(true);
        setLoadingError(null);

        try {
          const blob = await downloadFromBackend(activeTextUrl);
          if (!active) return;
          const text = await blob.text();
          setLocalTextContent(text);
        } catch (err) {
          console.error('Failed to pre-download Text:', err);
          if (active) {
            if (String(book.id).startsWith('gb-') || book.google_volume_id) setViewMode('google-preview');
            else setLoadingError(`Text download failed: ${err.message}`);
          }
        } finally {
          if (active) setLoadingBook(false);
        }
      }
    }

    loadBookData();

    return () => {
      active = false;
    };
  }, [viewMode, activeEpubUrl, activePdfUrl, resolving, book.has_pdf, book.id, retryCount]);

  // Adjust PDF responsive width based on container boundaries
  useEffect(() => {
    if (!pdfContainerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = Math.min(750, entry.contentRect.width - 48);
        setPdfWidth(width > 0 ? width : 600);
      }
    });
    resizeObserver.observe(pdfContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [viewMode]);

  // Save last read position in local storage and database
  const savePosition = (pos, forcedProgressVal = null) => {
    localStorage.setItem(`booklyn_pos_${book.id}`, pos);
    
    let progressVal = 0;
    if (forcedProgressVal !== null) {
      progressVal = forcedProgressVal;
    } else if (viewMode === 'pdf') {
      // Estimate PDF progress percentage
      progressVal = pdfNumPages ? Math.round((Number(pos) / pdfNumPages) * 100) : 0;
    } else {
      progressVal = Math.round(existingBookProgress || 0);
    }

    updateBook(book.id, {
      progress: progressVal,
      last_read: new Date().toISOString()
    }).catch(err => console.warn('Failed to sync book progress:', err));

    // Persist to Supabase reading_progress table
    dbService.progress.saveProgress(book.id, String(pos), progressVal)
      .catch(err => console.warn('[Booklyn Reader] Failed to sync precise progress to Supabase:', err));

    if (onProgressUpdate) {
      onProgressUpdate(progressVal, String(pos));
    }
  };

  const [existingBookProgress, setExistingBookProgress] = useState(book.progress || 0);

  useEffect(() => {
    localStorage.setItem(`booklyn_theme_${book.id}`, theme);
    applyEpubTheme();
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(`booklyn_font_${book.id}`, fontSize);
    applyEpubFontSize();
  }, [fontSize]);

  const applyEpubTheme = () => {
    if (!renditionRef.current) return;
    const themes = renditionRef.current.themes;
    
    themes.register('dark', {
      body: { background: '#0f172a', color: '#cbd5e1', fontFamily: 'Georgia, serif', lineHeight: '1.6' },
      p: { color: '#cbd5e1' }
    });
    themes.register('sepia', {
      body: { background: '#fefcf0', color: '#433422', fontFamily: 'Georgia, serif', lineHeight: '1.6' },
      p: { color: '#433422' }
    });
    themes.register('light', {
      body: { background: '#ffffff', color: '#1e293b', fontFamily: 'Georgia, serif', lineHeight: '1.6' },
      p: { color: '#1e293b' }
    });

    themes.select(theme);
  };

  const applyEpubFontSize = () => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  };

  const handleEpubLocationChanged = (cfi) => {
    if (cfi) {
      setEpubLocation(cfi);
      
      let estPages = Math.round(existingBookProgress || 0);
      try {
        if (renditionRef.current && renditionRef.current.book) {
          const locations = renditionRef.current.book.locations;
          if (locations && locations.length > 0) {
            const progress = locations.percentageFromCfi(cfi);
            estPages = Math.round(progress * (book.pages || 100));
            setExistingBookProgress(estPages);
            updateBook(book.id, { progress: estPages }).catch(() => {});
          }
        }
      } catch (e) {}

      savePosition(cfi, estPages);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setPdfNumPages(numPages);
    setPdfLoading(false);
  };

  const handlePdfPrevPage = () => {
    setPdfPageNumber(prev => {
      const next = Math.max(1, prev - 1);
      savePosition(next);
      return next;
    });
  };

  const handlePdfNextPage = () => {
    setPdfPageNumber(prev => {
      const next = Math.min(pdfNumPages || 1, prev + 1);
      savePosition(next);
      return next;
    });
  };

  const handleSaveNotes = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    setTimeout(() => {
      setSavingNote(false);
      setNoteText('');
      alert('Your insights have been synchronised with this book logs!');
    }, 400);
  };

  // Determine native canvas styles for PDF canvas rendering under different themes
  // Uses invert filters to map bright PDFs into dark/sepia canvas sheets perfectly
  const getPdfFilterStyle = () => {
    if (theme === 'dark') {
      return { filter: 'invert(0.9) hue-rotate(180deg) contrast(0.95)' };
    }
    if (theme === 'sepia') {
      return { filter: 'sepia(0.65) contrast(0.9) brightness(1.05)' };
    }
    return {};
  };

  // Derive the Google Books volume ID for embedded preview
  const googleVolumeId = (() => {
    if (String(book.id).startsWith('gb-')) return book.id.replace('gb-', '');
    if (book.google_volume_id) return book.google_volume_id;
    return null;
  })();

  // Format Unavailable only when there is truly no readable source at all
  const isFormatUnavailable =
    !resolving &&
    !activeEpubUrl &&
    !activePdfUrl &&
    !book.has_pdf &&
    viewMode !== 'google-preview' &&
    resolveError === 'no-source';

  if (typeof window === 'undefined' || !window.document || !window.document.body) {
    return null;
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[100] flex flex-col font-sans h-screen w-screen overflow-hidden transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#0b0f19]' : theme === 'sepia' ? 'bg-[#fdf9e9]' : 'bg-slate-50'
      }`}
    >
      {/* Header Panel */}
      <header className={`h-16 px-6 flex items-center justify-between border-b transition-all duration-300 ${
        theme === 'dark' ? 'bg-slate-950/80 border-white/5 !text-white' : theme === 'sepia' ? 'bg-[#f5f1de]/90 border-[#e5dfc9] !text-[#433422]' : 'bg-white/80 border-slate-200 !text-slate-800'
      } backdrop-blur-md z-10`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold ${
              theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-slate-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Exit Reader
          </button>
          <div className="h-4 w-px bg-zinc-300 dark:bg-white/10" />
          <div className="space-y-0.5">
            <h2 className="font-serif font-bold text-sm truncate max-w-[200px] md:max-w-md">{book.title}</h2>
            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-50">{book.author}</p>
          </div>
        </div>

        {/* Reader controls */}
        {!resolving && !isFormatUnavailable && (
          <div className="flex items-center gap-2">
            {/* Format toggle: EPUB vs PDF (Only show if both direct formats resolved) */}
            {activeEpubUrl && activePdfUrl && (
              <div className="flex items-center rounded-lg bg-black/5 dark:bg-white/5 p-0.5 border border-zinc-200 dark:border-white/5">
                <button
                  onClick={() => setViewMode('epub')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'epub' ? 'bg-booklyn-amber text-white shadow-sm' : 'opacity-60'}`}
                >
                  EPUB
                </button>
                <button
                  onClick={() => setViewMode('pdf')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'pdf' ? 'bg-booklyn-amber text-white shadow-sm' : 'opacity-60'}`}
                >
                  PDF
                </button>
              </div>
            )}

            {/* Font scaling slider (Only for EPUB) */}
            {viewMode === 'epub' && activeEpubUrl && (
              <div className="relative group">
                <button className={`p-2 rounded-xl transition-all border ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}>
                  <Type className="w-4 h-4" />
                </button>
                
                <div className={`absolute right-0 mt-2 p-4 w-52 rounded-2xl glass-overlay shadow-[0_8px_32px_rgba(0,0,0,0.45)] opacity-0 scale-95 pointer-events-none group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-[100]`}>
                  <span className="text-[10px] font-bold opacity-45 uppercase tracking-wider block mb-2">Font Scale ({fontSize}%)</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setFontSize(prev => Math.max(80, prev - 10))}
                      className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs font-bold"
                    >
                      A-
                    </button>
                    <input 
                      type="range" 
                      min="80" 
                      max="200" 
                      step="10" 
                      value={fontSize} 
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="flex-1 accent-booklyn-amber h-1 rounded-full cursor-pointer bg-zinc-200 dark:bg-white/10"
                    />
                    <button 
                      onClick={() => setFontSize(prev => Math.min(200, prev + 10))}
                      className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs font-bold"
                    >
                      A+
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ambient theme picker */}
            <div className="flex items-center rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-zinc-200 dark:border-white/5">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition-all ${theme === 'light' ? 'bg-white text-amber-500 shadow-sm' : 'opacity-65'}`}
                title="Light Theme"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('sepia')}
                className={`p-1.5 rounded-lg transition-all ${theme === 'sepia' ? 'bg-[#faf6e9] text-[#8c6239] shadow-sm' : 'opacity-65'}`}
                title="Sepia Theme"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'opacity-65'}`}
                title="Dark Theme"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Area: Viewport Canvas */}
        <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden h-full">
          
          {/* A. Resolving spinner state */}
          {resolving && (
            <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
              <RefreshCw className="w-10 h-10 text-booklyn-amber animate-spin" />
              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${textColorClass}`}>Opening Your Book</h4>
                <p className={`text-xs max-w-xs leading-relaxed ${descColorClass} opacity-85`}>
                  Searching for a free edition on Project Gutenberg. If not found, Google Books preview will load automatically...
                </p>
              </div>
            </div>
          )}

          {/* A2. Downloading / Loading spinner state */}
          {!resolving && loadingBook && (
            <div className="flex flex-col items-center justify-center gap-4 text-center p-8 animate-pulse">
              <RefreshCw className="w-10 h-10 text-booklyn-amber animate-spin" />
              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${textColorClass}`}>Downloading Ebook</h4>
                <p className={`text-xs max-w-xs leading-relaxed ${descColorClass} opacity-85`}>
                  Streaming digital book content into your Booklyn reader...
                </p>
              </div>
            </div>
          )}

          {/* A3. Downloading / Loading error state */}
          {!resolving && loadingError && (
            <div className="flex flex-col items-center justify-center gap-5 text-center p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className={`font-serif font-bold text-lg ${textColorClass}`}>Download Failed</h3>
                <p className={`text-xs leading-relaxed max-w-xs ${descColorClass} opacity-85`}>
                  {loadingError}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {googleVolumeId && (
                  <button
                    onClick={() => { setLoadingError(null); setViewMode('google-preview'); }}
                    className="px-5 py-2.5 rounded-xl bg-booklyn-amber hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    Read with Google Books
                  </button>
                )}
                <button
                  onClick={() => { setLoadingError(null); setRetryCount(prev => prev + 1); }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${
                    googleVolumeId
                      ? 'bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10'
                      : 'bg-booklyn-amber hover:brightness-110 text-white shadow-md'
                  }`}
                >
                  Retry Download
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  Return to Library
                </button>
              </div>
            </div>
          )}

          {/* B. Format Unavailable state */}
          {isFormatUnavailable && (
            <div className="flex flex-col items-center justify-center gap-5 text-center p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-booklyn-amber">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className={`font-serif font-bold text-lg ${textColorClass}`}>No Free Edition Found</h3>
                <p className={`text-xs leading-relaxed ${descColorClass} opacity-85`}>
                  This title does not have a freely downloadable EPUB or PDF on Project Gutenberg.
                  {googleVolumeId
                    ? ' You can read a preview of this book via Google Books below.'
                    : ' Try searching for this book in your library or another format.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {googleVolumeId && (
                  <button
                    onClick={() => setViewMode('google-preview')}
                    className="px-6 py-2.5 rounded-xl bg-booklyn-amber hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    Read with Google Books
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  Return to Library
                </button>
              </div>
            </div>
          )}

          {/* C. EPUB Viewer Viewport */}
          {!resolving && !isFormatUnavailable && !loadingBook && !loadingError && viewMode === 'epub' && localEpubUrl && !epubRenderFailed && (
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm relative border border-black/5 dark:border-white/5">
              <ReactReader
                url={localEpubUrl}
                epubInitOptions={{ openAs: 'epub' }}
                title={book.title}
                location={epubLocation}
                locationChanged={handleEpubLocationChanged}
                getRendition={(rendition) => {
                  renditionRef.current = rendition;
                  applyEpubTheme();
                  applyEpubFontSize();

                  // Detect EPUB parse/render failures via epubjs book events
                  try {
                    if (rendition.book) {
                      // openFailed fires when epubjs cannot open the zip/epub container
                      rendition.book.on('openFailed', () => {
                        console.warn('[Reader] epubjs openFailed — falling back to Google Books preview');
                        if (googleVolumeId) {
                          setViewMode('google-preview');
                        } else {
                          setEpubRenderFailed(true);
                        }
                      });
                    }
                  } catch (e) {
                    console.warn('[Reader] Could not attach epubjs event listener:', e);
                  }
                }}
                loadingView={
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 backdrop-blur-xs gap-4">
                    <RefreshCw className="w-8 h-8 text-booklyn-amber animate-spin" />
                    <p className="text-xs opacity-60">Initializing EPUB reflow engine...</p>
                  </div>
                }
              />
            </div>
          )}

          {/* C2. EPUB render failed — auto-switch or show fallback */}
          {!resolving && viewMode === 'epub' && epubRenderFailed && (
            <div className="flex flex-col items-center justify-center gap-5 text-center p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-booklyn-amber">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className={`font-serif font-bold text-lg ${textColorClass}`}>EPUB Could Not Render</h3>
                <p className={`text-xs leading-relaxed max-w-xs ${descColorClass} opacity-85`}>
                  The EPUB file format is not compatible with this reader. Try reading via Google Books or retry the download.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {googleVolumeId && (
                  <button
                    onClick={() => { setEpubRenderFailed(false); setViewMode('google-preview'); }}
                    className="px-5 py-2.5 rounded-xl bg-booklyn-amber hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    Read with Google Books
                  </button>
                )}
                <button
                  onClick={() => { setEpubRenderFailed(false); setLocalEpubUrl(null); setRetryCount(prev => prev + 1); }}
                  className="px-5 py-2.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  Retry Download
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  Return to Library
                </button>
              </div>
            </div>
          )}

          {/* C3. HTML Viewer Viewport */}
          {!resolving && !isFormatUnavailable && !loadingBook && !loadingError && viewMode === 'html' && localHtmlUrl && (
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm relative border border-black/5 dark:border-white/5 bg-white">
              <iframe
                src={localHtmlUrl}
                title={`Reading: ${book.title}`}
                className="w-full h-full border-0"
              />
            </div>
          )}

          {/* C4. Plain Text Viewer Viewport */}
          {!resolving && !isFormatUnavailable && !loadingBook && !loadingError && viewMode === 'text' && localTextContent && (
            <div className={`w-full h-full rounded-2xl overflow-auto custom-scrollbar p-8 shadow-sm relative border border-black/5 dark:border-white/5 ${theme === 'dark' ? 'bg-slate-900' : theme === 'sepia' ? 'bg-[#f5f1de]' : 'bg-white'}`}>
               <pre className={`font-serif whitespace-pre-wrap text-sm md:text-base leading-relaxed max-w-3xl mx-auto ${textColorClass}`}>
                 {localTextContent}
               </pre>
            </div>
          )}

          {/* D. Native PDF Document Viewer (No iframe, no redirect) */}
          {!resolving && !isFormatUnavailable && !loadingBook && !loadingError && viewMode === 'pdf' && localPdfUrl && (
            <div ref={pdfContainerRef} className="w-full h-full flex flex-col bg-slate-900/5 dark:bg-black/25 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 relative">
              {/* PDF Zoom Toolbar */}
              <div className="h-11 px-4 bg-black/10 dark:bg-black/40 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setPdfScale(prev => Math.max(0.5, prev - 0.1))} 
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-bold opacity-60">{Math.round(pdfScale * 100)}%</span>
                  <button 
                    onClick={() => setPdfScale(prev => Math.min(2.0, prev + 0.1))} 
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <span className="text-[10px] tracking-wider uppercase font-bold opacity-45">In-App PDF Viewport</span>
              </div>

              {/* PDF Page Canvas */}
              <div className="flex-1 overflow-auto custom-scrollbar p-6 flex items-start justify-center">
                <Document
                  file={localPdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadStart={() => setPdfLoading(true)}
                  loading={
                    <div className="flex flex-col items-center justify-center gap-3 p-12">
                      <RefreshCw className="w-8 h-8 text-booklyn-amber animate-spin" />
                      <p className="text-xs opacity-60">Initializing canvas engine...</p>
                    </div>
                  }
                  error={
                    <div className="text-center p-8 space-y-2">
                      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                      <h4 className="font-bold text-xs">Could not load PDF content</h4>
                      <p className="text-[10px] opacity-60 max-w-xs">Dynamic resolve URL could not fetch the document binary.</p>
                    </div>
                  }
                >
                  <div style={getPdfFilterStyle()} className="transition-all duration-300 shadow-xl rounded-lg overflow-hidden">
                    <Page 
                      pageNumber={pdfPageNumber} 
                      scale={pdfScale} 
                      width={pdfWidth}
                      renderTextLayer={false} 
                      renderAnnotationLayer={false} 
                    />
                  </div>
                </Document>
              </div>

              {/* PDF Stepper pagination */}
              {pdfNumPages && (
                <div className="h-12 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/50 flex items-center justify-between px-6 text-xs z-10">
                  <button 
                    onClick={handlePdfPrevPage} 
                    disabled={pdfPageNumber <= 1}
                    className="p-1 px-3 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 disabled:opacity-30 flex items-center gap-1 font-bold transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="font-semibold opacity-70">Page {pdfPageNumber} of {pdfNumPages}</span>
                  <button 
                    onClick={handlePdfNextPage} 
                    disabled={pdfPageNumber >= pdfNumPages}
                    className="p-1 px-3 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 disabled:opacity-30 flex items-center gap-1 font-bold transition-all"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* E. Google Books Embedded Viewer — universal fallback for modern / copyrighted titles */}
          {!resolving && viewMode === 'google-preview' && googleVolumeId && (
            <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 relative">
              {/* Viewer toolbar */}
              <div className={`h-11 px-4 flex items-center justify-between text-xs border-b ${
                theme === 'dark'
                  ? 'bg-slate-900 border-white/10 text-slate-300'
                  : theme === 'sepia'
                  ? 'bg-[#f5f1de] border-[#e5dfc9] text-[#5c4a37]'
                  : 'bg-white border-slate-100 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-booklyn-amber" />
                  <span className="font-bold tracking-wide uppercase text-[10px]">Google Books Preview</span>
                </div>
                <span className="text-[10px] opacity-50">Preview pages may vary by publisher agreement</span>
              </div>

              {/* Embedded Google Books viewer iframe */}
              <iframe
                key={googleVolumeId}
                src={`https://books.google.com/books?id=${googleVolumeId}&printsec=frontcover&output=embed`}
                title={`Reading: ${book.title}`}
                className="flex-1 w-full border-0"
                style={
                  theme === 'dark'
                    ? { filter: 'invert(0.88) hue-rotate(180deg) contrast(0.92) brightness(0.95)', background: '#0b0f19' }
                    : theme === 'sepia'
                    ? { filter: 'sepia(0.5) contrast(0.92) brightness(1.02)', background: '#fdf9e9' }
                    : { background: '#f8fafc' }
                }
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
          )}

          {/* F. Open Library Viewer */}
          {!resolving && viewMode === 'openlibrary' && activeOpenLibraryUrl && (
            <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 relative">
              <div className={`h-11 px-4 flex items-center justify-between text-xs border-b ${
                theme === 'dark'
                  ? 'bg-slate-900 border-white/10 text-slate-300'
                  : theme === 'sepia'
                  ? 'bg-[#f5f1de] border-[#e5dfc9] text-[#5c4a37]'
                  : 'bg-white border-slate-100 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-booklyn-amber" />
                  <span className="font-bold tracking-wide uppercase text-[10px]">Open Library Viewer</span>
                </div>
              </div>
              <iframe
                src={activeOpenLibraryUrl}
                title={`Reading: ${book.title}`}
                className="flex-1 w-full border-0"
              />
            </div>
          )}
        </div>
        
        {/* Right Area: Session Notes & Utilities (Desktop only) */}
        {!isFormatUnavailable && (
          <aside className={`w-full md:w-80 border-t md:border-t-0 md:border-l p-5 flex flex-col h-72 md:h-full transition-all duration-300 ${
            theme === 'dark' ? 'bg-[#060a12] border-white/5 text-white' : theme === 'sepia' ? 'bg-[#f5f1de]/70 border-[#e5dfc9] text-[#433422]' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-4 h-4 text-booklyn-amber" />
              <h3 className="font-serif font-bold text-sm tracking-tight">Reflections Log</h3>
            </div>

            <p className="text-[10px] opacity-60 mb-3 leading-relaxed">
              Record core concepts, questions, or vocabulary notes directly inside your Booklyn log repository as you read.
            </p>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Capture your thoughts here..."
              className={`flex-1 p-3 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-booklyn-amber resize-none mb-3 transition-all ${
                theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-stone-50 border-stone-200 placeholder-zinc-400'
              }`}
            />

            <button
              onClick={handleSaveNotes}
              disabled={savingNote || !noteText.trim()}
              className="w-full py-2.5 rounded-xl bg-booklyn-amber hover:brightness-110 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-glow-amber/5 active:scale-95 transition-all"
            >
              {savingNote ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>Log Reflections</span>
            </button>
          </aside>
        )}
      </div>
    </motion.div>,
    document.body
  );
}
