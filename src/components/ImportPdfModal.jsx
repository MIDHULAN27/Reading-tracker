import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Book, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

const BOOKLYN_GRADIENTS = [
  { name: 'Warm Amber', class: 'from-amber-600 to-amber-950' },
  { name: 'Obsidian Lavender', class: 'from-indigo-600 to-indigo-950' },
  { name: 'Forest Sage', class: 'from-emerald-600 to-emerald-950' },
  { name: 'Velvet Wine', class: 'from-rose-600 to-rose-950' },
  { name: 'Autumn Rust', class: 'from-orange-600 to-orange-950' },
  { name: 'Deep Teal', class: 'from-teal-600 to-teal-950' }
];

const GENRES = [
  'Fiction', 'Non-Fiction', 'Science', 'Technology', 'Biography', 
  'History', 'Philosophy', 'Poetry', 'Self-Help', 'Education', 'Other'
];

export default function ImportPdfModal({ isOpen, onClose }) {
  const { addPdfBook } = useLibraryStore();
  const fileInputRef = useRef(null);

  // File states
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');
  const [genre, setGenre] = useState('Education');
  const [status, setStatus] = useState('to_read');
  const [coverColor, setCoverColor] = useState(BOOKLYN_GRADIENTS[0].class);
  
  // Status states
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Lightweight native client-side PDF page counter
  const parsePdfPageCount = async (pdfFile) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function() {
        try {
          const arr = new Uint8Array(reader.result);
          const decoder = new TextDecoder('utf-8');
          
          // Step 1: Scan last 100KB (typical footer metadata location for /Count)
          const footerText = decoder.decode(arr.slice(-1024 * 100));
          let match = footerText.match(/\/Count\s+(\d+)/);
          
          if (!match) {
            // Step 2: Fallback to full file decode if small/moderate
            const fullText = decoder.decode(arr);
            match = fullText.match(/\/Count\s+(\d+)/);
          }
          
          if (match) {
            const pagesCount = parseInt(match[1], 10);
            if (pagesCount > 0 && pagesCount < 10000) {
              resolve(pagesCount);
              return;
            }
          }
          resolve(null);
        } catch (err) {
          console.warn('Lite PDF page scan failed:', err);
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(pdfFile);
    });
  };

  const handleFileProcess = async (selectedFile) => {
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      setError('Please import a valid PDF document.');
      return;
    }

    setError('');
    setParsing(true);
    setFile(selectedFile);
    
    // Auto-populate Title from filename
    const cleanTitle = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, ' ');
    setTitle(cleanTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    setAuthor('');

    // Generate dynamic cover gradient from title hashing
    const hash = cleanTitle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const selectedGrad = BOOKLYN_GRADIENTS[hash % BOOKLYN_GRADIENTS.length].class;
    setCoverColor(selectedGrad);

    // Parse page count
    const detectedPages = await parsePdfPageCount(selectedFile);
    if (detectedPages) {
      setPages(detectedPages);
    } else {
      setPages(150); // Sensible fallback default
    }
    setParsing(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileProcess(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title) return;

    setImporting(true);
    setError('');
    try {
      await addPdfBook({
        title,
        author: author || 'Unknown Author',
        pages: Number(pages) || 100,
        genre,
        status,
        cover_color: coverColor
      }, file);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFile(null);
        setTitle('');
        setAuthor('');
        setPages('');
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to complete book import.');
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setTitle('');
    setAuthor('');
    setPages('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-[6px]"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar glass-overlay border border-white/15 dark:border-white/10 rounded-3xl p-6 sm:p-8 text-left z-10 space-y-6 pointer-events-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 pb-4">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-booklyn-night-300 dark:text-white flex items-center gap-2">
              <Book className="w-6 h-6 text-booklyn-amber" />
              <span>Import Educational PDF Book</span>
            </h2>
            <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 mt-1">
              Add locally owned PDFs to read them offline and log pages automatically.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-booklyn-night-100/50 dark:text-booklyn-cream-200/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Success State */}
        {success ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 flex flex-col items-center justify-center space-y-4 text-center"
          >
            <CheckCircle className="w-16 h-16 text-emerald-500 animate-bounce" />
            <h3 className="font-serif text-xl font-bold text-booklyn-night-300 dark:text-white">Import Complete!</h3>
            <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 max-w-sm">
              "{title}" has been successfully added to your Virtual Sanctuary shelf and offline library.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* File Drag and Drop / Selector */}
            {!file ? (
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer p-8 sm:p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center space-y-3 transition-all duration-300 ${
                  dragActive 
                    ? 'border-booklyn-amber bg-booklyn-amber/5' 
                    : 'border-booklyn-cream-300 hover:border-booklyn-amber bg-black/5 dark:bg-white/5'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="application/pdf"
                  className="hidden" 
                />
                
                <div className="p-4 rounded-full bg-white dark:bg-white/5 border border-white/10 shadow-sm transform group-hover:scale-110 duration-300">
                  <UploadCloud className="w-8 h-8 text-booklyn-amber" />
                </div>
                
                <div className="space-y-1">
                  <p className="font-serif font-bold text-sm sm:text-base text-booklyn-night-300 dark:text-white">
                    Drag & Drop your legal PDF book here
                  </p>
                  <p className="text-xs text-booklyn-night-100/40 dark:text-booklyn-cream-200/35">
                    or click to browse local files (max 50MB recommended)
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-black/10 dark:bg-white/5 border border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-8 h-8 text-red-500/80 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs truncate max-w-[280px] sm:max-w-[400px]">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/30">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleRemoveFile}
                  className="text-xs font-bold uppercase tracking-wider text-red-500 hover:brightness-110 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  Change
                </button>
              </div>
            )}

            {/* Parsing State */}
            {parsing && (
              <div className="flex items-center justify-center gap-2 text-xs font-serif text-booklyn-amber animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning PDF metadata and page layouts...
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Metadata Fields and Interactive Cover Preview */}
            {file && !parsing && (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {/* Visual Cover Preview Card */}
                <div className="flex flex-col items-center justify-center space-y-3">
                  <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block text-center w-full">
                    Cover Preview
                  </span>
                  
                  <div className={`w-36 h-52 rounded-2xl bg-gradient-to-tr ${coverColor} text-white shadow-xl flex flex-col items-center justify-between p-4 border border-white/15 text-center transition-all duration-300`}>
                    <Book className="w-8 h-8 opacity-60 mt-4" />
                    <h4 className="font-serif font-bold text-xs tracking-tight line-clamp-3 leading-snug px-1">
                      {title || 'Untitled PDF Book'}
                    </h4>
                    <p className="text-[9px] uppercase font-bold tracking-wider opacity-75 truncate max-w-full mb-2">
                      {author || 'Unknown Author'}
                    </p>
                  </div>
                </div>

                {/* Form fields */}
                <div className="md:col-span-2 space-y-4">
                  {/* Title & Author */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 pl-0.5">
                        Book Title *
                      </label>
                      <input 
                        type="text" 
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Clean Code"
                        className="w-full glass-input text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 pl-0.5">
                        Author Name
                      </label>
                      <input 
                        type="text" 
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="e.g. Robert C. Martin"
                        className="w-full glass-input text-xs"
                      />
                    </div>
                  </div>

                  {/* Pages, Genre, and Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 pl-0.5">
                        Total Pages *
                      </label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={pages}
                        onChange={(e) => setPages(e.target.value)}
                        className="w-full glass-input text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 pl-0.5">
                        Genre
                      </label>
                      <select 
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="w-full glass-input text-xs pr-8"
                      >
                        {GENRES.map(g => (
                          <option key={g} value={g} className="bg-booklyn-cream-50 dark:bg-booklyn-night-200">{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 pl-0.5">
                        Target Shelf
                      </label>
                      <select 
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full glass-input text-xs pr-8"
                      >
                        <option value="to_read" className="bg-booklyn-cream-50 dark:bg-booklyn-night-200">Want to Read</option>
                        <option value="reading" className="bg-booklyn-cream-50 dark:bg-booklyn-night-200">Currently Reading</option>
                      </select>
                    </div>
                  </div>

                  {/* Cover Design Options */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 pl-0.5 block">
                      Choose Sanctuary Gradient Style
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {BOOKLYN_GRADIENTS.map((grad) => (
                        <button
                          key={grad.name}
                          type="button"
                          onClick={() => setCoverColor(grad.class)}
                          className={`w-7 h-7 rounded-full bg-gradient-to-tr ${grad.class} border-2 transition-all ${
                            coverColor === grad.class 
                              ? 'border-booklyn-amber scale-110 ring-2 ring-booklyn-amber/25' 
                              : 'border-white/20 hover:scale-105'
                          }`}
                          title={grad.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Submission and Close buttons */}
                  <div className="flex gap-3 justify-end pt-3 border-t border-booklyn-cream-300/20 dark:border-white/5">
                    <button 
                      type="submit"
                      disabled={importing}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark hover:brightness-110 text-white font-bold text-xs shadow-md shadow-booklyn-amber/10 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {importing ? 'Importing File...' : 'Add to Virtual Shelf'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
