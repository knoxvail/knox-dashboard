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
          900: '#0a0a0a',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
