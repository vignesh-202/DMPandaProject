/** @type {import('tailwindcss').Config} */
const withOpacity = (cssVar) => `rgb(var(${cssVar}) / <alpha-value>)`;
const scale = (name) => ({
  50: withOpacity(`--${name}-50`),
  100: withOpacity(`--${name}-100`),
  200: withOpacity(`--${name}-200`),
  300: withOpacity(`--${name}-300`),
  400: withOpacity(`--${name}-400`),
  500: withOpacity(`--${name}-500`),
  600: withOpacity(`--${name}-600`),
  700: withOpacity(`--${name}-700`),
  800: withOpacity(`--${name}-800`),
  900: withOpacity(`--${name}-900`),
});

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: scale('neutral'),
        slate: scale('neutral'),
        zinc: scale('neutral'),
        neutral: scale('neutral'),
        stone: scale('neutral'),
        blue: scale('blue'),
        indigo: scale('blue'),
        purple: scale('purple'),
        pink: scale('pink'),
        red: scale('red'),
        orange: scale('orange'),
        yellow: scale('yellow'),
        green: scale('green'),
        emerald: scale('green'),
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-hover': 'rgb(var(--border-hover) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
          muted: 'rgb(var(--destructive-muted) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          foreground: 'rgb(var(--success-foreground) / <alpha-value>)',
          muted: 'rgb(var(--success-muted) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          foreground: 'rgb(var(--warning-foreground) / <alpha-value>)',
          muted: 'rgb(var(--warning-muted) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
          elevated: 'rgb(var(--card-elevated) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'rgb(var(--sidebar) / <alpha-value>)',
          foreground: 'rgb(var(--sidebar-foreground) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border) / <alpha-value>)',
          accent: 'rgb(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'rgb(var(--sidebar-accent-foreground) / <alpha-value>)',
        },
        instagram: {
          purple: '#833AB4',
          pink: '#FD1D1D',
          orange: '#F56040',
          yellow: '#FCAF45',
          blue: '#405DE6',
          // Gradient stops
          start: '#405DE6',
          mid1: '#833AB4',
          mid2: '#FD1D1D',
          mid3: '#F56040',
          end: '#FCAF45',
          // Legacy mappings
          red: '#ED4956',
          lightPink: '#FFEEF0',
        },
        ig: {
          purple: 'rgb(var(--ig-purple) / <alpha-value>)',
          pink: 'rgb(var(--ig-pink) / <alpha-value>)',
          orange: 'rgb(var(--ig-orange) / <alpha-value>)',
          yellow: 'rgb(var(--ig-yellow) / <alpha-value>)',
          blue: 'rgb(var(--ig-blue) / <alpha-value>)',
          'blue-light': 'rgb(var(--ig-blue-light) / <alpha-value>)',
          'blue-message': 'rgb(var(--ig-blue-message) / <alpha-value>)',
          'gray-light': 'rgb(var(--ig-gray-light) / <alpha-value>)',
          'gray-medium': 'rgb(var(--ig-gray-medium) / <alpha-value>)',
          'gray-dark': 'rgb(var(--ig-gray-dark) / <alpha-value>)',
        },
        facebook: '#1877F2',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        'md': 'var(--radius)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'glow': 'var(--shadow-glow)',
        'instagram': 'var(--shadow-instagram)',
        'ig-purple': '0 4px 14px 0 rgba(131, 58, 180, 0.3)',
        'ig-glow': '0 0 20px rgba(131, 58, 180, 0.25), 0 0 40px rgba(253, 29, 29, 0.15)',
      },
      backgroundImage: {
        'ig-gradient': 'linear-gradient(45deg, #405DE6, #833AB4, #FD1D1D, #F56040, #FCAF45)',
        'ig-gradient-reverse': 'linear-gradient(45deg, #FCAF45, #F56040, #FD1D1D, #833AB4, #405DE6)',
        'ig-gradient-vertical': 'linear-gradient(180deg, #405DE6, #833AB4, #FD1D1D, #F56040, #FCAF45)',
        'ig-gradient-radial': 'radial-gradient(circle, #833AB4, #FD1D1D, #F56040)',
      },
      keyframes: {
        'dash': {
          '0%': { 'stroke-dashoffset': 251.2 },
          '100%': { 'stroke-dashoffset': 0 },
        },
        'color-cycle': {
          '0%, 100%': { color: '#86efac' },
          '33%': { color: '#fde047' },
          '66%': { color: '#f87171' },
        },
        'pulse-fast': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(16px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-in-down': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-16px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-in-right': {
          '0%': {
            opacity: '0',
            transform: 'translateX(16px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        'fade-in-scale': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-8px)',
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
        'scan': {
          '0%': {
            top: '0%',
            opacity: '0',
          },
          '50%': {
            opacity: '1'
          },
          '100%': {
            top: '100%',
            opacity: '0',
          },
        },
        'radio-wave': {
          '0%': {
            transform: 'scale(1)',
            opacity: '1',
          },
          '100%': {
            transform: 'scale(2.5)',
            opacity: '0',
          },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ig-gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'ig-pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(131, 58, 180, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(131, 58, 180, 0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'fade-in-down': 'fade-in-down 0.4s ease-out forwards',
        'fade-in-right': 'fade-in-right 0.3s ease-out forwards',
        'fade-in-scale': 'fade-in-scale 0.25s ease-out forwards',
        float: 'float 3s ease-in-out infinite',
        'flip-down-out': 'flip-down-out 0.3s ease-in-out forwards',
        'flip-down-in': 'flip-down-in 0.3s ease-in-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast-delay': 'pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) 0.2s infinite',
        'pulse-fast-delay-2': 'pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) 0.4s infinite',
        'spin-slow': 'spin 2s linear infinite',
        'dash': 'dash 1.2s ease-in-out infinite',
        'color-cycle': 'color-cycle 6s ease-in-out infinite',
        'color-change': 'color-change 4.5s linear infinite',
        'scan': 'scan 2s ease-in-out infinite',
        'radio-wave': 'radio-wave 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'ig-gradient': 'ig-gradient-shift 3s ease infinite',
        'ig-pulse': 'ig-pulse-glow 2s ease-in-out infinite',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [
    require('tailwindcss-filters'),
  ],
}
