import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Sparkles, BookOpen, ChevronRight, X,
  Library, BarChart2, Target, Bookmark, BookOpenCheck
} from 'lucide-react';
import { useGuestGuardStore } from '../store/useGuestGuardStore';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../context/ThemeContext';
import logoBrandDarkGold from '../assets/logo-brand-dark-gold.png';
import logoBrandLight from '../assets/logo-brand-light.png';

const PREMIUM_FEATURES = [
  { icon: BookOpen, label: 'Immersive Reader' },
  { icon: Bookmark, label: 'Save & Bookmark' },
  { icon: BarChart2, label: 'Reading Analytics' },
  { icon: Target, label: 'Goals & Streaks' },
];

export default function PremiumLoginModal() {
  const { isOpen, featureName, closeGuard } = useGuestGuardStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const modalRef = useRef(null);

  // Debug log when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log("Auth modal opened");
    }
  }, [isOpen]);

  // Auto-close the modal when user becomes authenticated
  useEffect(() => {
    if (isOpen && user && !user.is_anonymous && !user.email?.includes('guest')) {
      console.log("Login success");
      closeGuard();
    }
  }, [isOpen, user, closeGuard]);

  // Trap focus and handle escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') closeGuard();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeGuard]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSignIn = () => {
    console.log("Navigating to auth page");
    // Ensure redirect path is saved (fallback if not already set by guard)
    const currentPath = window.location.pathname + window.location.search;
    if (!localStorage.getItem("redirectAfterLogin")) {
      localStorage.setItem("redirectAfterLogin", currentPath);
    }
    closeGuard();
    navigate('/auth', { state: { from: currentPath, isPush: true } });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeGuard(); }}
        >
          {/* Backdrop — pointer-events-none so it never blocks clicks */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-none" />

          {/* Modal Panel — stop propagation so clicks inside don't close */}
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glowing accents */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-booklyn-amber/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-booklyn-lavender/10 blur-3xl pointer-events-none" />

            {/* Card content */}
            <div className="relative glass-overlay rounded-3xl p-6 sm:p-8 border border-white/15 dark:border-white/10">
              
              {/* Close button */}
              <button
                onClick={closeGuard}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 dark:bg-white/5 border border-white/15 dark:border-white/10 text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 hover:bg-white/25 dark:hover:bg-white/10 hover:text-booklyn-night-300 dark:hover:text-white transition-all"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Lock Icon Badge */}
              <div className="flex justify-center mb-5">
                <motion.div 
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
                  className="relative"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-booklyn-amber/20 to-booklyn-lavender/15 dark:from-booklyn-amber/15 dark:to-booklyn-lavender/10 border border-booklyn-amber/25 dark:border-booklyn-amber/15 flex items-center justify-center shadow-lg shadow-booklyn-amber/10"
                  >
                    <Lock className="w-7 h-7 text-booklyn-amber dark:text-booklyn-amber-light" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-booklyn-amber to-booklyn-amber-dark flex items-center justify-center shadow-md">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </motion.div>
              </div>

              {/* Title */}
              <div className="text-center space-y-2 mb-6">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-booklyn-night-300 dark:text-white leading-tight">
                  Sign In to Unlock
                </h2>
                <p className="text-xs sm:text-sm text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 leading-relaxed font-medium max-w-xs mx-auto">
                  <span className="font-bold text-booklyn-amber dark:text-booklyn-amber-light">{featureName}</span> is a premium feature available to signed-in readers. Create a free account to unlock everything.
                </p>
              </div>

              {/* Feature Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {PREMIUM_FEATURES.map(({ icon: Icon, label }, idx) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.06 }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/20 dark:bg-white/5 border border-white/15 dark:border-white/8"
                  >
                    <div className="w-8 h-8 rounded-xl bg-booklyn-amber/10 dark:bg-booklyn-amber/8 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-booklyn-amber dark:text-booklyn-amber-light" />
                    </div>
                    <span className="text-[11px] font-semibold text-booklyn-night-200 dark:text-booklyn-cream-100 leading-tight">{label}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3">
                <button
                  id="premium-modal-sign-in"
                  onClick={handleSignIn}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-bold text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-booklyn-amber/25 flex items-center justify-center gap-2 cursor-pointer relative z-20"
                >
                  <span>Sign In / Create Account</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={closeGuard}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 dark:bg-white/5 border border-white/15 dark:border-white/10 text-booklyn-night-100/60 dark:text-booklyn-cream-200/40 hover:bg-white/20 dark:hover:bg-white/8 hover:text-booklyn-night-300 dark:hover:text-booklyn-cream-100 transition-all font-semibold text-[11px] uppercase tracking-wider"
                >
                  Continue Browsing
                </button>
              </div>

              {/* Footer branding */}
              <div className="mt-5 pt-4 border-t border-white/10 dark:border-white/5 flex items-center justify-center gap-2">
                <img 
                  src={theme === 'dark' ? logoBrandDarkGold : logoBrandLight}
                  alt="Booklyn"
                  className="h-5 w-auto opacity-40"
                />
                <span className="text-[9px] font-bold uppercase tracking-widest text-booklyn-night-100/30 dark:text-booklyn-cream-200/20">
                  Free Forever · No Credit Card
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

