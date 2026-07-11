import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { dbService } from '../services/db';
import { 
  Mail, Lock, User, ChevronRight, 
  AlertCircle, Sparkles, Eye, EyeOff, Check, 
  HelpCircle, ArrowLeft, BookOpenCheck, RefreshCw, X 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import logoBrandLight from '../assets/logo-brand-light.png';
import logoBrandDarkWhite from '../assets/logo-brand-dark-white.png';
import logoBrandDarkGold from '../assets/logo-brand-dark-gold.png';
import logoEmblemLight from '../assets/logo-emblem-light.png';
import logoEmblemDarkGold from '../assets/logo-emblem-dark-gold.png';

export default function Auth() {
  const { theme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Active slideshow index for the premium quote carousel
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { 
    signIn, signUp, signInWithGoogle, resetPassword, 
    guestLogin, user, error, loading, clearError,
    isConfigured, envIssues, checkConfig
  } = useAuthStore();

  const dbStatus = dbService.getConnectionDetails();
  
  const [retryLoading, setRetryLoading] = useState(false);

  const handleRetryConnection = async () => {
    setRetryLoading(true);
    try {
      await checkConfig();
    } catch (err) {
      console.error('[Booklyn Auth Retry] Connection recovery error:', err);
    } finally {
      // Premium transition delay
      setTimeout(() => {
        setRetryLoading(false);
      }, 800);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Connected':
        return 'border-green-500/30 text-green-500 bg-green-500/10';
      case 'Testing Connection':
      case 'Pending Validation':
        return 'border-amber-500/30 text-amber-500 bg-amber-500/10 animate-pulse';
      case 'Disconnected':
      case 'Unconfigured':
      default:
        return 'border-red-500/30 text-red-500 bg-red-500/10';
    }
  };

  const quotes = [
    { 
      text: "“I have always imagined that Paradise will be a kind of library.”", 
      author: "Jorge Luis Borges",
      book: "Poetic Fragments"
    },
    { 
      text: "“Reading is a conversation. All books talk. But a good book listens as well.”", 
      author: "Mark Haddon",
      book: "The Curious Incident"
    },
    { 
      text: "“A room without books is like a body without a soul.”", 
      author: "Marcus Tullius Cicero",
      book: "Classical Essays"
    }
  ];

  // Rotate quotes every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      const redirect = localStorage.getItem("redirectAfterLogin");
      const destination = redirect || "/";
      const fromPath = location.state?.from;
      const isPush = location.state?.isPush;

      const performRedirect = () => {
        localStorage.removeItem("redirectAfterLogin");
        if (isPush && fromPath === destination) {
          navigate(-1);
        } else {
          navigate(destination, { replace: true });
        }
      };
      
      if (successMessage) {
        console.log("Login success");
        console.log("Redirecting to:", destination);
        const timer = setTimeout(performRedirect, 1500);
        return () => clearTimeout(timer);
      } else {
        console.log("Login success");
        console.log("Redirecting to:", destination);
        performRedirect();
      }
    }
  }, [user, navigate, successMessage, location.state]);

  useEffect(() => {
    // Clear any store errors when switching forms
    clearError();
    setValidationError('');
    setSuccessMessage('');
    setPassword('');
  }, [isLogin, clearError]);

  // Real-time password validations
  const hasMinLength = password.length >= 6;
  const hasNumberOrSpecial = /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMessage('');

    if (!email || !password) {
      setValidationError('Please fill in all required credentials.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    if (!isLogin && !fullName.trim()) {
      setValidationError('Please enter your full name.');
      return;
    }

    if (!hasMinLength || !hasNumberOrSpecial) {
      setValidationError('Please satisfy all password safety criteria.');
      return;
    }

    try {
      if (isLogin) {
        await signIn(email, password);
        setSuccessMessage('Successfully signed in! Redirecting to dashboard...');
      } else {
        const result = await signUp(email, password, fullName);
        if (result?.session) {
          setSuccessMessage('Account created successfully! Redirecting to dashboard...');
        } else {
          setSuccessMessage('Account created successfully! Please check your email inbox to verify your account.');
        }
      }
    } catch (err) {
      // Error is caught and displayed by the auth store's error state via toast
      console.error('[Booklyn Auth Page] Form submission error:', err.message);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess(false);

    if (!forgotEmail) {
      setForgotError('Please enter a recovery email address.');
      return;
    }

    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail);
      setForgotSuccess(true);
      setForgotEmail('');
    } catch (err) {
      setForgotError(err.message || 'Failed to dispatch recovery link.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      // Error is managed inside the store; log for diagnostics
      console.error('[Booklyn Auth Page] Google sign-in error:', err.message);
    }
  };

  const handleGuestEntry = async () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-booklyn-cream-50 dark:bg-booklyn-night-300 text-booklyn-night-100 dark:text-booklyn-cream-50 overflow-hidden font-sans transition-colors duration-500 relative">
      
      {/* LEFT GALLERY PANEL - Immersive Visual Branding (Desktop only) */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-12 bg-gradient-to-tr from-booklyn-cream-100 to-booklyn-cream-200 dark:from-booklyn-night-200 dark:to-booklyn-night-300 overflow-hidden border-r border-booklyn-cream-300/40 dark:border-white/5 select-none">
        
        {/* Glowing background shapes */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full ambient-glow-1 animate-float pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full ambient-glow-2 animate-pulse-subtle pointer-events-none" />

        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center select-none">
          <img
            src={theme === 'dark' ? logoBrandDarkGold : logoBrandLight}
            alt="Booklyn Brand Logo"
            className="h-12 w-auto object-contain transition-all duration-300 hover:scale-105 filter drop-shadow-[0_0_10px_rgba(255,184,77,0.3)] dark:drop-shadow-[0_0_16px_rgba(255,184,77,0.6)] will-change-transform transform-gpu"
          />
        </div>

        {/* Middle Stage: Aesthetic Floating Books and Animated Quote Slider */}
        <div className="relative my-auto flex flex-col items-center justify-center py-10 z-10">
          
          {/* Floating book showcase */}
          <div className="relative w-80 h-48 mb-12 flex justify-center items-center">
            {/* Ambient gold glow under books */}
            <div className="absolute inset-0 bg-booklyn-amber/5 blur-3xl rounded-full" />
            
            {/* Book Card 1 */}
            <motion.div 
              initial={{ rotate: -15, x: -50, y: 10, opacity: 0 }}
              animate={{ rotate: -12, x: -45, y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="absolute w-28 h-40 rounded-xl bg-gradient-to-tr from-orange-800 to-booklyn-amber text-white p-3 shadow-2xl flex flex-col justify-between border border-white/10 hover:scale-105 transition-all"
            >
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">Vol. 01</div>
              <div className="font-serif font-bold text-xs leading-tight">The Art of Reading</div>
              <div className="flex justify-between items-center text-[7px] font-semibold opacity-80 pt-2 border-t border-white/10">
                <span>MIDNIGHT</span>
                <Sparkles className="w-2.5 h-2.5 text-yellow-300" />
              </div>
            </motion.div>

            {/* Book Card 2 (Main floating center book) */}
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: -10, opacity: 1 }}
              transition={{ 
                duration: 1.2, 
                delay: 0.4,
                y: { duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
              }}
              className="absolute w-32 h-44 rounded-xl bg-gradient-to-tr from-booklyn-night-100 to-indigo-950 dark:from-indigo-950 dark:to-booklyn-night-400 text-white p-4 shadow-2xl flex flex-col justify-between border border-white/15 z-20"
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase tracking-wider text-booklyn-amber">Featured</span>
                <BookOpenCheck className="w-4 h-4 text-booklyn-amber" />
              </div>
              <div className="font-serif font-bold text-sm leading-snug">Curating Your Mind's Shelves</div>
              <div className="flex justify-between items-center text-[8px] font-bold pt-2 border-t border-white/10 text-booklyn-cream-200">
                <span>BOOKLYN ARCHIVES</span>
                <span>2026</span>
              </div>
            </motion.div>

            {/* Book Card 3 */}
            <motion.div 
              initial={{ rotate: 15, x: 50, y: 15, opacity: 0 }}
              animate={{ rotate: 12, x: 45, y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="absolute w-28 h-40 rounded-xl bg-gradient-to-tr from-indigo-900 to-booklyn-lavender text-white p-3 shadow-2xl flex flex-col justify-between border border-white/10 hover:scale-105 transition-all"
            >
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">Vol. 03</div>
              <div className="font-serif font-bold text-xs leading-tight">Habits & Quiet Corners</div>
              <div className="flex justify-between items-center text-[7px] font-semibold opacity-80 pt-2 border-t border-white/10">
                <span>LAVENDER</span>
                <Check className="w-2.5 h-2.5 text-green-300" />
              </div>
            </motion.div>
          </div>

          {/* Animated Quote Carousel */}
          <div className="max-w-md text-center px-6 min-h-[140px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeQuoteIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.6 }}
                className="space-y-4"
              >
                <p className="font-serif text-xl md:text-2xl italic leading-relaxed text-booklyn-night-300 dark:text-booklyn-cream-100">
                  {quotes[activeQuoteIndex].text}
                </p>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-booklyn-amber">
                    {quotes[activeQuoteIndex].author}
                  </h4>
                  <span className="text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 font-semibold italic">
                    in {quotes[activeQuoteIndex].book}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Brand Details */}
        <div className="relative z-10 text-[10px] uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 font-bold flex justify-between items-center">
          <span>Booklyn © 2026</span>
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-green-500" />
            Supabase Cloud Core Active
          </span>
        </div>
      </div>

      {/* RIGHT ACTION PANEL - Forms, Validation & Social entry */}
      <div className="w-full lg:w-2/5 flex flex-col justify-center items-center px-6 py-12 relative z-10 bg-white/20 dark:bg-booklyn-night-300/30 backdrop-blur-md">
        
        {/* Responsive glowing ambient sphere on mobile */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full ambient-glow-1 pointer-events-none lg:hidden" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full ambient-glow-2 pointer-events-none lg:hidden" />

        {/* Branding header on mobile viewport */}
        <div className="text-center mb-8 lg:hidden flex flex-col items-center justify-center">
          <img
            src={theme === 'dark' ? logoBrandDarkGold : logoBrandLight}
            alt="Booklyn Brand Logo"
            className="h-14 w-auto object-contain transition-all duration-300 mb-4 filter drop-shadow-[0_0_10px_rgba(255,184,77,0.3)] dark:drop-shadow-[0_0_16px_rgba(255,184,77,0.6)] will-change-transform transform-gpu"
          />
          <p className="text-xs text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
            Your ultimate sanctuary for digital reading journals.
          </p>
        </div>

        {/* Main Auth Interaction Card */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 border border-white/20 dark:border-white/10 shadow-2xl relative overflow-hidden"
        >
          {/* Tab Selector */}
          <div className="flex border-b border-booklyn-cream-300/50 dark:border-booklyn-night-100/10 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 pb-3 text-center text-xs sm:text-sm font-semibold tracking-wide border-b-2 transition-all duration-300 ${
                isLogin 
                  ? 'border-booklyn-amber text-booklyn-amber dark:text-booklyn-amber-light font-bold' 
                  : 'border-transparent text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 hover:text-booklyn-night-100 dark:hover:text-booklyn-cream-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 pb-3 text-center text-xs sm:text-sm font-semibold tracking-wide border-b-2 transition-all duration-300 ${
                !isLogin 
                  ? 'border-booklyn-amber text-booklyn-amber dark:text-booklyn-amber-light font-bold' 
                  : 'border-transparent text-booklyn-night-100/40 dark:text-booklyn-cream-200/40 hover:text-booklyn-night-100 dark:hover:text-booklyn-cream-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'signin' : 'signup'}
                initial={{ opacity: 0, x: isLogin ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 12 : -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Full name input (signup only) */}
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 pl-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-booklyn-night-100/40 dark:text-booklyn-cream-200/30" />
                      <input
                        type="text"
                        required
                        placeholder="Elizabeth Bennet"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full !pl-10 !pr-4 !py-2.5 glass-input text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Email input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 pl-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-booklyn-night-100/40 dark:text-booklyn-cream-200/30" />
                    <input
                      type="email"
                      required
                      placeholder="reader@booklyn.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full !pl-10 !pr-4 !py-2.5 glass-input text-xs"
                    />
                  </div>
                </div>

                {/* Password input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50">
                      Password
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[10px] font-bold text-booklyn-amber dark:text-booklyn-amber-light hover:underline bg-transparent border-none cursor-pointer focus:outline-none"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-booklyn-night-100/40 dark:text-booklyn-cream-200/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full !pl-10 !pr-10 !py-2.5 glass-input text-xs"
                    />
                    {/* Password Visibility Toggle Eye Icon */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 hover:text-booklyn-night-100 dark:hover:text-white transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* REAL-TIME PASSWORD STRENGTH CRITERIA BADGES */}
            {password.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-2xl bg-white/20 dark:bg-black/10 border border-white/10 text-[10px] font-semibold space-y-1.5"
              >
                <p className="text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 uppercase tracking-wider text-[8px] font-bold">Password strength checkpoints:</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${hasMinLength ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500/60'}`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={hasMinLength ? 'text-green-600 dark:text-green-400 font-bold' : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40'}>At least 6 characters</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${hasNumberOrSpecial ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500/60'}`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className={hasNumberOrSpecial ? 'text-green-600 dark:text-green-400 font-bold' : 'text-booklyn-night-100/50 dark:text-booklyn-cream-200/40'}>Contains a number or special char</span>
                </div>
              </motion.div>
            )}

            {/* Error notifications are handled by the floating Toast system */}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-semibold text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-booklyn-amber/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign Into Account' : 'Create Account'}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-[1px] bg-booklyn-cream-300/60 dark:bg-booklyn-night-100/10" />
            <span className="px-3.5 text-[10px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 font-bold tracking-widest uppercase">Or Sync with</span>
            <div className="flex-1 h-[1px] bg-booklyn-cream-300/60 dark:bg-booklyn-night-100/10" />
          </div>

          {/* Google SSO Login Button */}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-white/20 dark:bg-white/5 border border-booklyn-cream-300 dark:border-white/10 text-booklyn-night-300 dark:text-booklyn-cream-100 hover:bg-white/35 dark:hover:bg-white/10 active:scale-[0.98] transition-all duration-200 flex items-center justify-center font-bold text-xs uppercase tracking-wider shadow-sm"
            >
              <svg className="w-4.5 h-4.5 mr-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Sign In with Google</span>
            </button>

            {/* Guest entry fallback bypass */}
            <button
              type="button"
              onClick={handleGuestEntry}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-tr from-booklyn-amber/5 to-booklyn-lavender/5 hover:from-booklyn-amber/10 hover:to-booklyn-lavender/10 border border-booklyn-amber/20 dark:border-white/10 text-booklyn-night-300 dark:text-booklyn-cream-100 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2.5 font-bold text-xs uppercase tracking-wider"
            >
              <Sparkles className="w-4.5 h-4.5 text-booklyn-amber flex-shrink-0" />
              <span>Explore as Guest</span>
            </button>
          </div>
        </motion.div>

        {/* Diagnostic Connection info */}
        <div className="text-center mt-6 text-[9px] uppercase tracking-widest text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 font-bold flex items-center gap-2 relative z-10 select-none">
          <span>Active Connection: </span>
          <span className={`font-bold py-0.5 px-2 rounded-lg border ${getStatusColor(dbStatus.status)}`}>
            {dbStatus.status === 'Pending Validation' ? 'Validating...' : dbStatus.status}
          </span>
        </div>
      </div>

      {/* FORGOT PASSWORD OVERLAY MODAL */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal close bypass click handler */}
            <div className="absolute inset-0 cursor-default" onClick={() => { if(!forgotLoading) setShowForgotModal(false); }} />

            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/20 dark:border-white/10 shadow-2xl relative z-10 overflow-hidden text-xs"
            >
              {/* Glowing header circle */}
              <div className="absolute top-[-50px] right-[-50px] w-36 h-36 rounded-full bg-booklyn-amber/10 blur-xl pointer-events-none" />

              {/* Title Section */}
              <div className="flex items-center gap-3 border-b border-booklyn-cream-300/50 dark:border-booklyn-night-100/10 pb-4 mb-4">
                <button 
                  onClick={() => setShowForgotModal(false)}
                  disabled={forgotLoading}
                  className="p-1.5 rounded-lg bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/35 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all text-booklyn-night-100 dark:text-booklyn-cream-50"
                  title="Return to login"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-booklyn-night-300 dark:text-white">Recover Password</h3>
                  <p className="text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 font-semibold uppercase tracking-wider mt-0.5">Shelves key backup</p>
                </div>
              </div>

              {/* Recovery Form */}
              {!forgotSuccess ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-booklyn-night-100/70 dark:text-booklyn-cream-200/50 leading-relaxed font-medium">
                    Please provide the email address registered to your Booklyn library. We will dispatch a recovery email containing a secure link to override your password credentials.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 pl-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-booklyn-night-100/40 dark:text-booklyn-cream-200/30" />
                      <input
                        type="email"
                        required
                        placeholder="reader@booklyn.app"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full !pl-10 !pr-4 !py-2.5 glass-input text-xs"
                      />
                    </div>
                  </div>

                  {forgotError && (
                    <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                      <span className="font-semibold leading-normal">{forgotError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-booklyn-amber to-booklyn-amber-dark text-white font-semibold text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-booklyn-amber/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Send Recovery Instructions</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-5 py-4 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-center mx-auto shadow-md shadow-green-500/5">
                    <Check className="w-6 h-6 animate-pulse" />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-serif text-base font-bold text-green-600 dark:text-green-400">Recovery email dispatched!</h4>
                    <p className="text-booklyn-night-100/70 dark:text-booklyn-cream-200/50 leading-relaxed font-medium px-2">
                      A secure recovery link was dispatched successfully. Open the link to return to your shelves and instantly establish your new password key.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(false);
                      setShowForgotModal(false);
                    }}
                    className="py-2.5 px-6 rounded-xl bg-white/20 dark:bg-white/5 border border-booklyn-cream-300 dark:border-white/10 text-booklyn-night-300 dark:text-booklyn-cream-100 hover:bg-white/35 dark:hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-wider shadow-sm"
                  >
                    Return to Login
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification Container */}
      <div className="fixed top-6 right-6 z-[100] w-full max-w-sm flex flex-col gap-3 px-4 sm:px-0 pointer-events-none">
        <AnimatePresence>
          {/* 1. Supabase / Connection Diagnostic Toast */}
          {(dbStatus.status === 'Unconfigured' || dbStatus.status === 'Disconnected') && (
            <motion.div
              key="db-diagnostic-toast"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="pointer-events-auto w-full p-4 rounded-2xl glass-panel border border-amber-500/25 dark:border-amber-500/15 shadow-2xl relative overflow-hidden backdrop-blur-xl bg-white/60 dark:bg-booklyn-night-300/60"
            >
              {/* Decorative top colored border/accent */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-booklyn-amber" />
              
              <div className="flex gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 h-fit">
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif text-sm font-bold text-booklyn-night-300 dark:text-white leading-tight">
                        {dbStatus.status === 'Unconfigured' ? 'Database Unconfigured' : 'Connection Disconnected'}
                      </h4>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mt-0.5">
                        SaaS Diagnostics Active
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 leading-relaxed font-medium">
                    {dbStatus.status === 'Unconfigured' 
                      ? "Booklyn is running in Unconfigured Mode. Supabase environment variables are missing from your .env file."
                      : "Could not establish a connection to your Supabase PostgreSQL database instance. Please check your credentials."}
                  </p>

                  {/* Environment Issues checklist if Unconfigured */}
                  {dbStatus.status === 'Unconfigured' && envIssues && envIssues.length > 0 && (
                    <div className="py-1 px-2.5 rounded-lg bg-black/5 dark:bg-black/20 text-[9px] font-semibold text-booklyn-night-100/60 dark:text-booklyn-cream-200/50 space-y-0.5">
                      {envIssues.map((issue, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleRetryConnection}
                      disabled={retryLoading || loading}
                      className="px-3 py-1.5 rounded-lg bg-booklyn-amber hover:bg-booklyn-amber-dark text-white font-bold text-[10px] uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none shadow-sm shadow-booklyn-amber/20"
                    >
                      <RefreshCw className={`w-3 h-3 ${retryLoading ? 'animate-spin' : ''}`} />
                      <span>{retryLoading ? 'Verifying...' : 'Retry Connection'}</span>
                    </button>
                    
                    <span className="text-[9.5px] text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 font-bold uppercase tracking-widest animate-pulse">
                      Offline Mode Active
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. Authentication State Error Toast */}
          {error && (
            <motion.div
              key="auth-error-toast"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-auto w-full p-4 rounded-2xl glass-panel border border-red-500/20 dark:border-red-500/10 shadow-2xl relative overflow-hidden backdrop-blur-xl bg-white/60 dark:bg-booklyn-night-300/60"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-red-500" />
              <div className="flex gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-500 h-fit">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif text-sm font-bold text-booklyn-night-300 dark:text-white leading-tight">Authentication Error</h4>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-red-500 mt-0.5">Operation Failed</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearError}
                      className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 hover:text-booklyn-night-100 dark:hover:text-white p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 leading-relaxed font-medium">
                    {error}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. Form Validation Error Toast */}
          {validationError && (
            <motion.div
              key="validation-error-toast"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-auto w-full p-4 rounded-2xl glass-panel border border-red-500/20 dark:border-red-500/10 shadow-2xl relative overflow-hidden backdrop-blur-xl bg-white/60 dark:bg-booklyn-night-300/60"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-red-500" />
              <div className="flex gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-500 h-fit">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif text-sm font-bold text-booklyn-night-300 dark:text-white leading-tight">Validation Alert</h4>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-red-500 mt-0.5">Input Check Failed</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setValidationError('')}
                      className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 hover:text-booklyn-night-100 dark:hover:text-white p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 leading-relaxed font-medium">
                    {validationError}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. Success Toast */}
          {successMessage && (
            <motion.div
              key="auth-success-toast"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-auto w-full p-4 rounded-2xl glass-panel border border-green-500/20 dark:border-green-500/10 shadow-2xl relative overflow-hidden backdrop-blur-xl bg-white/60 dark:bg-booklyn-night-300/60"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-green-500" />
              <div className="flex gap-3">
                <div className="p-2 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 h-fit">
                  <Check className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif text-sm font-bold text-booklyn-night-300 dark:text-white leading-tight">Success</h4>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mt-0.5 font-sans">Operation Completed</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSuccessMessage('')}
                      className="text-booklyn-night-100/40 dark:text-booklyn-cream-200/30 hover:text-booklyn-night-100 dark:hover:text-white p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-booklyn-night-100/70 dark:text-booklyn-cream-200/60 leading-relaxed font-medium">
                    {successMessage}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Inline missing database connection icons helper
function Database(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}
