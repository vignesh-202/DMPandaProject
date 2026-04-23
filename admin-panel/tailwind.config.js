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
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: scale('neutral'),
        slate: scale('neutral'),
        zinc: scale('neutral'),
        neutral: scale('neutral'),
        border: withOpacity('--border'),
        background: withOpacity('--background'),
        foreground: withOpacity('--foreground'),
        card: withOpacity('--card'),
        muted: {
          DEFAULT: withOpacity('--muted'),
          foreground: withOpacity('--muted-foreground'),
        },
        primary: {
          DEFAULT: withOpacity('--primary'),
          hover: withOpacity('--primary-hover'),
          foreground: withOpacity('--primary-foreground'),
        },
        secondary: {
          DEFAULT: withOpacity('--secondary'),
          foreground: withOpacity('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: withOpacity('--destructive'),
          foreground: withOpacity('--destructive-foreground'),
          muted: withOpacity('--destructive-muted'),
        },
        success: {
          DEFAULT: withOpacity('--success'),
          foreground: withOpacity('--success-foreground'),
          muted: withOpacity('--success-muted'),
        },
        warning: {
          DEFAULT: withOpacity('--warning'),
          foreground: withOpacity('--warning-foreground'),
          muted: withOpacity('--warning-muted'),
        },
        sidebar: {
          DEFAULT: withOpacity('--sidebar'),
          foreground: withOpacity('--sidebar-foreground'),
          border: withOpacity('--sidebar-border'),
          accent: withOpacity('--sidebar-accent'),
          'accent-foreground': withOpacity('--sidebar-accent-foreground'),
        },
        ig: {
          blue: '#405DE6',
          purple: '#833AB4',
          pink: '#FD1D1D',
          orange: '#F56040',
          yellow: '#FCAF45',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      backgroundImage: {
        'ig-gradient': 'linear-gradient(45deg, #405DE6, #833AB4, #FD1D1D, #F56040, #FCAF45)',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [],
};
