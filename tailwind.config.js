/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gloria: {
          // Gloria Jean's brand-ish palette
          brown: '#4b2e2e',
          accent: '#8b5e34',
          cream: '#f7f3ee'
        }
      }
    }
  },
  plugins: []
}
