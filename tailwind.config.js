/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
      },
      fontFamily: {
        sans: ['"Karla"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Karla"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Karla"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        theSeasons: ['"The Seasons"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        codec: ['"Karla"', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#252c33',
        anthracite: {
          DEFAULT: '#313941',
          base: '#313941',
          deep: '#1c2126',
          dark: '#252c33',
          surface: '#313941',
          light: '#3b4550',
          lighter: '#4d5967',
        },
        brandRed: {
          DEFAULT: '#FF0000',
          hover: '#d60000',
          dark: '#b30000',
          light: '#ff3333',
          soft: 'rgba(255, 0, 0, 0.15)',
        },
        ivory: {
          DEFAULT: '#fffff1',
          soft: 'rgba(255, 255, 241, 0.85)',
          muted: 'rgba(255, 255, 241, 0.65)',
        },
        surface: {
          950: '#1c2126',
          900: '#252c33',
          850: '#2b333c',
          800: '#313941',
          750: '#39434e',
          700: '#434e5c',
          600: '#556374',
        },
        accent: {
          DEFAULT: '#b99881',
          light: '#d6beae',
          dark: '#96745f',
          soft: 'rgba(185, 152, 129, 0.15)',
        },
        brand: {
          anthracite: '#313941',
          red: '#FF0000',
          white: '#fffff1',
        },
      },
      boxShadow: {
        'glass': '0 4px 20px 0 rgba(0, 0, 0, 0.3)',
        'glass-glow': '0 0 16px rgba(255, 0, 0, 0.25)',
        'brand-red': '0 4px 20px -2px rgba(255, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
