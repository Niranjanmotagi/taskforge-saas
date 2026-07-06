/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@taskforge/shared-ui/tailwind-preset')],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
