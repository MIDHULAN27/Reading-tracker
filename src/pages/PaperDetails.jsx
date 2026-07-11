import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, FileText, Bookmark, BookmarkCheck, Calendar, 
  Award, Quote, RefreshCw, AlertCircle, ExternalLink, Download, 
  BookOpen, Sparkles, HelpCircle 
} from 'lucide-react';
import { papersApi } from '../api/papersApi';
import { usePaperStore } from '../store/usePaperStore';

export default function PaperDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { savedPapers, bookmarkPaper, unbookmarkPaper, fetchSavedPapers } = usePaperStore();

  const [paperDetails, setPaperDetails] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [error, setError] = useState('');
  
  // PDF Viewer states
  const [iframeError, setIframeError] = useState(false);

  const isSaved = savedPapers.some(p => p.id === id);

  useEffect(() => {
    let active = true;
    let timeoutId = null;

    async function loadPaperData() {
      setLoading(true);
      setError('');
      
      console.log('[PaperDetails] Loading paper details for ID:', id);
      
      try {
        // Set a 10-second timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (active) {
            console.error('[PaperDetails] Paper load timeout after 10 seconds');
            setError('Paper details took too long to load. Please try again.');
            setLoading(false);
          }
        }, 10000);
        
        await fetchSavedPapers();
        
        // Fetch detailed paper metadata
        console.log('[PaperDetails] Fetching paper details from API...');
        const data = await papersApi.getPaperDetails(id);
        
        if (active) {
          console.log('[PaperDetails] Paper details received:', data?.title);
          setPaperDetails(data);
          setLoading(false);
          
          // Trigger recommendation fetch in background
          setLoadingRecs(true);
          try {
            console.log('[PaperDetails] Fetching recommendations...');
            const recs = await papersApi.getRecommendations(id, 4);
            if (active) {
              console.log('[PaperDetails] Recommendations received:', recs.length);
              setRecommendations(recs);
            }
          } catch (recErr) {
            console.warn('[PaperDetails] Failed recommendations fetch:', recErr.message);
          } finally {
            if (active) setLoadingRecs(false);
          }
        }
      } catch (err) {
        if (active) {
          console.error('[PaperDetails] Error loading paper:', err.message);
          setError(err.message || 'Failed to fetch detailed research paper catalog data.');
          setLoading(false);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    loadPaperData();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, fetchSavedPapers]);

  const handleBookmarkToggle = async () => {
    if (!paperDetails) return;
    try {
      if (isSaved) {
        await unbookmarkPaper(id);
      } else {
        await bookmarkPaper(paperDetails);
      }
    } catch (err) {
      console.error('Bookmark toggle failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-booklyn-amber animate-spin" />
        <p className="font-serif italic text-sm text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
          Fetching deep academic records...
        </p>
      </div>
    );
  }

  if (error || !paperDetails) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Link to="/discover" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 hover:text-booklyn-amber dark:hover:text-booklyn-amber-light">
          <ChevronLeft className="w-4 h-4" /> Back to Discover
        </Link>
        <div className="p-8 text-center glass-panel border border-red-500/20 rounded-3xl space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto opacity-70" />
          <h3 className="font-serif text-2xl font-bold">Academic Record Fetch Error</h3>
          <p className="text-sm max-w-md mx-auto text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
            {error || 'This scientific research paper record could not be loaded from Semantic Scholar index directories.'}
          </p>
          <button onClick={() => navigate('/discover')} className="px-6 py-2.5 rounded-xl bg-booklyn-amber text-white font-semibold text-xs hover:brightness-115 active:scale-95 transition-all">
            Back to Search Switcher
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-16">
      {/* Ambient glassmorphic glowing spotlights */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full ambient-glow-2 pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-[450px] h-[450px] rounded-full ambient-glow-1 pointer-events-none" />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Navigation / Actions Header */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 hover:text-booklyn-night-300 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {/* Save Bookmark Action */}
          <button 
            onClick={handleBookmarkToggle}
            className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm transition-all ${
              isSaved 
                ? 'bg-booklyn-amber/15 border-booklyn-amber/30 text-booklyn-amber hover:bg-booklyn-amber/25'
                : 'bg-white/20 dark:bg-white/5 border-white/20 dark:border-white/10 hover:bg-white/30 hover:text-booklyn-amber'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-4 h-4 fill-current" />
                <span>Bookmarked</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>Save to Library</span>
              </>
            )}
          </button>
        </div>

        {/* Header Metadata Section */}
        <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-5 relative overflow-hidden">
          {/* Subtle decoration overlay */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-tr from-booklyn-amber/10 to-booklyn-lavender/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap gap-2 items-center">
            {paperDetails.fields && paperDetails.fields.map((field, idx) => (
              <span key={idx} className="px-3 py-1 rounded-full bg-booklyn-amber/15 dark:bg-booklyn-amber-light/10 text-booklyn-amber dark:text-booklyn-amber-light text-[10px] font-bold uppercase tracking-widest">
                {field}
              </span>
            ))}
            <span className="px-2.5 py-0.5 rounded-md bg-white/25 dark:bg-white/5 border border-white/10 text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 font-semibold uppercase tracking-wider">
              {paperDetails.source || 'Semantic Scholar API'}
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-booklyn-night-300 dark:text-white leading-tight max-w-5xl">
              {paperDetails.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 font-serif">
              <span className="font-bold underline decoration-booklyn-amber/40">
                {paperDetails.authors.join(', ')}
              </span>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-booklyn-amber" />
                {paperDetails.journal || 'Academic Research'} ({paperDetails.year})
              </span>
            </div>
          </div>

          {/* Quick Metrics grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-booklyn-cream-300/40 dark:border-booklyn-night-100/10">
            
            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-booklyn-amber/10 text-booklyn-amber">
                <Quote className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block">Total Citations</span>
                <span className="font-sans font-bold text-base text-booklyn-night-300 dark:text-white">
                  {paperDetails.citationCount.toLocaleString()} citations
                </span>
              </div>
            </div>

            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block">Impact Rating</span>
                <span className="font-sans font-bold text-base text-booklyn-night-300 dark:text-white">
                  {paperDetails.citationCount > 5000 ? 'High-Impact Publication' : 'Active Index Study'}
                </span>
              </div>
            </div>

            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 uppercase tracking-widest block">Access Status</span>
                <span className="font-sans font-bold text-base text-booklyn-night-300 dark:text-white">
                  {paperDetails.pdf_url ? '🔓 Open Access PDF' : '🔒 Subscription Catalog'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Split Section: PDF Frame vs Abstract Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Area: Abstract, recommendations & PDF fallbacks */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Abstract card */}
            <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="font-serif font-bold text-xl text-booklyn-night-300 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-booklyn-amber" />
                <span>Abstract synopsis</span>
              </h3>
              <p className="font-serif text-sm sm:text-base leading-relaxed text-booklyn-night-100/75 dark:text-booklyn-cream-200/70 text-justify border-l-2 border-booklyn-amber/20 pl-4 py-1">
                {paperDetails.abstract || 'No detailed publication abstract synopsis is currently available for this study index.'}
              </p>
            </div>

            {/* Embed PDF Viewer Frame */}
            <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 pb-4">
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-xl text-booklyn-night-300 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-booklyn-amber" />
                    <span>Academic PDF Document Frame</span>
                  </h3>
                  <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40">
                    Direct access via secure sandbox frame.
                  </p>
                </div>

                {paperDetails.pdf_url && (
                  <a 
                    href={paperDetails.pdf_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-booklyn-amber hover:brightness-110 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Direct Download
                  </a>
                )}
              </div>

              {paperDetails.pdf_url ? (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-booklyn-night-400/50 h-[500px]">
                  {!iframeError ? (
                    <iframe
                      src={`https://docs.google.com/gview?url=${encodeURIComponent(paperDetails.pdf_url)}&embedded=true`}
                      className="w-full h-full border-none shadow-inner"
                      title={paperDetails.title}
                      onError={() => setIframeError(true)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <HelpCircle className="w-12 h-12 text-booklyn-amber/50" />
                      <h4 className="font-serif font-bold text-lg">Frame Embedding Restriction</h4>
                      <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 max-w-md">
                        This PDF server prohibits external framing due to strict university CORS policies. Open the publication in a separate secure browser tab.
                      </p>
                      <a 
                        href={paperDetails.pdf_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-5 py-2 rounded-xl bg-booklyn-amber text-white font-bold text-xs"
                      >
                        Open PDF in New Tab
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-black/5 dark:bg-white/5 border border-dashed border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 space-y-4">
                  <AlertCircle className="w-12 h-12 text-booklyn-amber/50 mx-auto" />
                  <h4 className="font-serif font-bold text-lg">Subscription Access Gate</h4>
                  <p className="text-xs text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 max-w-md mx-auto leading-relaxed">
                    This scholarly record is successfully indexed in academic directories, but direct digital file distribution requires institutional access credentials. Visit the publication's official landing page to unlock contents.
                  </p>
                  <a 
                    href={`https://www.semanticscholar.org/paper/${id}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white/20 dark:bg-white/5 border border-white/10 hover:bg-white/30 text-xs font-bold rounded-xl transition-all"
                  >
                    <span>View Semantic Scholar Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

            </div>

          </div>

          {/* Right Sidebar: Recommendations & metadata references */}
          <div className="space-y-8">
            
            {/* Recommendations Row Feed */}
            <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 space-y-5">
              <h3 className="font-serif font-bold text-lg text-booklyn-night-300 dark:text-white flex items-center gap-2 pl-1 border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 pb-3">
                <Sparkles className="w-4 h-4 text-booklyn-amber" />
                <span>Related Research Studies</span>
              </h3>

              {loadingRecs ? (
                <div className="py-6 text-center">
                  <RefreshCw className="w-6 h-6 text-booklyn-amber animate-spin mx-auto" />
                </div>
              ) : recommendations.length === 0 ? (
                <p className="text-xs text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 pl-1">
                  No related reference studies matched this topic index.
                </p>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <Link 
                      key={rec.id} 
                      to={`/paper/${rec.id}`}
                      className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 hover:border-booklyn-amber/30 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex flex-col space-y-2 group block"
                    >
                      <h4 className="font-serif font-bold text-xs text-booklyn-night-300 dark:text-white leading-snug group-hover:text-booklyn-amber transition-colors line-clamp-2">
                        {rec.title}
                      </h4>
                      <div className="flex justify-between items-center text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/45">
                        <span className="truncate max-w-[120px] font-medium">{rec.authors[0]} et al.</span>
                        <span className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-white/5 font-sans font-bold">
                          {rec.citationCount > 1000 ? `${(rec.citationCount / 1000).toFixed(1)}k` : rec.citationCount} quotes
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick publication tips */}
            <div className="glass-panel border-white/20 dark:border-white/5 rounded-3xl p-6 space-y-3.5">
              <h4 className="font-serif font-bold text-sm text-booklyn-night-300 dark:text-white pl-1">
                Scholarly Citing Reference
              </h4>
              <p className="text-[11px] text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 leading-relaxed pl-1">
                To cite this paper in your bibliographies:
              </p>
              
              <div className="p-3 rounded-xl bg-black/10 dark:bg-white/5 border border-white/5 select-all text-[10px] font-mono leading-relaxed text-booklyn-night-100/75 dark:text-booklyn-cream-200/70 break-words">
                {paperDetails.authors[0]} et al. ({paperDetails.year}). "{paperDetails.title}". {paperDetails.journal || 'Academic Journals'}.
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
