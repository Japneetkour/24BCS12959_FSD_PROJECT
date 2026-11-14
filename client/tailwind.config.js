import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef1ff',
          100: '#e0e5ff',
          200: '#c7cfff',
          300: '#a4afff',
          400: '#8085fd',
          500: '#6461f6',
          600: '#5443ea',
          700: '#4836cf',
          800: '#3b2fa7',
          900: '#332d84',
          950: '#1f1a4d',
        },
        ink: {
          50: '#f7f8fb',
          100: '#eef0f5',
          200: '#dfe2ea',
          300: '#c3c8d5',
          400: '#8f96a8',
          500: '#687087',
          600: '#4d546a',
          700: '#363c4f',
          800: '#1f2433',
          850: '#181c29',
          900: '#121521',
          950: '#0b0d16',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        pop: '0 12px 32px -8px rgba(16,24,40,.18), 0 4px 8px -4px rgba(16,24,40,.08)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        'scale-in': 'scale-in .15s ease-out',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
};
