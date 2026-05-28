import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import logoEmblemLight from '../assets/logo-emblem-light.png';
import logoEmblemDarkGold from '../assets/logo-emblem-dark-gold.png';

export default function LoadingScreen() {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cozy-cream-100/40 dark:bg-cozy-night-300/40 backdrop-blur-xl transition-all duration-300">
      {/* Decorative ambient backdrop light circles */}
      <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] rounded-full bg-cozy-amber/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-cozy-lavender/5 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel max-w-sm w-full p-8 border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden"
      >
        {/* Spinner Ring */}
        <div className="relative w-20 h-20 flex items-center justify-center mb-6">
          <svg className="w-full h-full transform animate-spin" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-cozy-cream-300/50 dark:text-cozy-night-100/20"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="url(#spinnerGradient)"
              strokeWidth="6"
              strokeDasharray="250"
              strokeDashoffset="180"
              strokeLinecap="round"
              fill="transparent"
            />
            <defs>
              <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.img
              src={theme === 'dark' ? logoEmblemDarkGold : logoEmblemLight}
              alt="Booklyn Logo Emblem"
              className="w-9 h-9 object-contain transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,184,77,0.4)] dark:drop-shadow-[0_0_16px_rgba(255,184,77,0.65)] will-change-transform transform-gpu"
              animate={{
                scale: [0.93, 1.07, 0.93],
                opacity: [0.8, 1, 0.8]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
        </div>

        <h3 className="font-serif font-bold text-lg text-cozy-night-300 dark:text-white leading-snug tracking-tight">
          Opening Booklyn...
        </h3>
        <p className="text-xs text-cozy-night-100/60 dark:text-cozy-cream-200/40 mt-2 font-medium">
          Setting up your reading sanctuary
        </p>

        {/* Pulsing micro indicators */}
        <div className="flex gap-1.5 mt-5">
          <span className="w-1.5 h-1.5 rounded-full bg-cozy-amber animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-cozy-amber animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-cozy-amber animate-bounce" />
        </div>
      </motion.div>
    </div>
  );
}
