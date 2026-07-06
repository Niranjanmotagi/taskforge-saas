/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@taskforge/shared-ui/tailwind-preset')],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
  ],
  plugins: [require('tailwindcss-animate')],
};
