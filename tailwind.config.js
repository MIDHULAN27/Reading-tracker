/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        booklyn: {
          // Warm book cream light mode colors
          cream: {
            50: '#fdfbf7',
            100: '#FAF6F0',
            200: '#F4ECE1',
            300: '#EADCC9',
            400: '#DCC3A8',
            500: '#C9A380',
          },
          // Rich velvet obsidian dark mode colors
          night: {
            50: '#1b1d28',
            100: '#13151f',
            200: '#0e1017',
            300: '#090a0f',
            400: '#050508',
          },
          // Soft lavender and warm amber accents
          amber: {
            light: '#F59E0B',
            DEFAULT: '#D97706',
            dark: '#B45309',
          },
          lavender: {
            light: '#EEF2FF',
            DEFAULT: '#818CF8',
            dark: '#4F46E5',
          },
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.04)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-amber': '0 0 15px rgba(217, 119, 6, 0.15)',
        'glow-lavender': '0 0 15px rgba(129, 140, 248, 0.15)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}
