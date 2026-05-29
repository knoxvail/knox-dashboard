/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          0: '#ffffff',
          50: '#fafafa',
          100: '#f5f5f5',
          150: '#f0f0f0',
          200: '#e5e5e5',
          300: '#d0d0d0',
          400: '#a6a6a6',
          500: '#808080',
          600: '#666666',
          700: '#404040',
          800: '#262626',
          900: '#1a1a1a',
          950: '#0d0d0d',
        },
        indigo: {
          600: '#6366f1',
          700: '#4f46e5',
        },
        emerald: {
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        amber: {
          600: '#d97706',
          900: '#92400e',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.4)',
        md: '0 4px 6px rgba(0, 0, 0, 0.5)',
        lg: '0 10px 25px rgba(0, 0, 0, 0.6)',
        xl: '0 20px 40px rgba(0, 0, 0, 0.7)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.8)',
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
