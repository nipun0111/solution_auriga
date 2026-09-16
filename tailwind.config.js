/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        display: ['DM Sans', 'sans-serif'],
        body: ['Manrope', 'sans-serif']
      }
    }
  },
  plugins: []
};
