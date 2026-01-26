/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'dash': {
          '0%': { 'stroke-dashoffset': 251.2 },
          '100%': { 'stroke-dashoffset': 0 },
        },
        'color-cycle': {
          '0%, 100%': { color: '#86efac' }, // green
          '33%': { color: '#fde047' }, // yellow
          '66%': { color: '#f87171' }, // red
        },
        'pulse-fast': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-in-right': {
          '0%': {
            opacity: '0',
            transform: 'translateX(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
        'flip-down-out': {
          '0%': {
            transform: 'rotateX(0deg)',
          },
          '100%': {
            transform: 'rotateX(-90deg)',
          },
        },
        'flip-down-in': {
          '0%': {
            transform: 'rotateX(90deg)',
          },
          '100%': {
            transform: 'rotateX(0deg)',
          },
        },
      },
      colors: {
        instagram: {
          start: '#405DE6',
          middle: '#5B51D8',
          end: '#833AB4',
          pink: '#C13584',
          red: '#E1306C',
          orange: '#FD1D1D',
          yellow: '#F56040',
          lightYellow: '#FFDC80',
        },
        facebook: '#1877F2',
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'fade-in-right': 'fade-in-right 0.6s ease-out forwards',
        float: 'float 3s ease-in-out infinite',
        'flip-down-out': 'flip-down-out 0.5s ease-in-out forwards',
        'flip-down-in': 'flip-down-in 0.5s ease-in-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse-fast 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast-delay': 'pulse-fast 1.2s cubic-bezier(0.4, 0, 0.6, 1) 0.2s infinite',
        'pulse-fast-delay-2': 'pulse-fast 1.2s cubic-bezier(0.4, 0, 0.6, 1) 0.4s infinite',
        'spin-slow': 'spin 2s linear infinite',
        'dash': 'dash 1.5s ease-in-out infinite',
        'color-cycle': 'color-cycle 6s ease-in-out infinite',
        'color-change': 'color-change 4.5s linear infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-filters'),
  ],
}
