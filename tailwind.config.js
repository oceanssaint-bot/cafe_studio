/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gloria: {
          // Office-mode driven (CSS vars set per data-office): Store = warm brown +
          // GJ Orange; Head Office = charcoal + Tasty Teal. Falls back to brand brown.
          brown: 'rgb(var(--gj-brown) / <alpha-value>)',
          accent: 'rgb(var(--gj-accent) / <alpha-value>)',
          cream: 'rgb(var(--gj-cream) / <alpha-value>)'
        }
      }
    }
  },
  plugins: []
}
