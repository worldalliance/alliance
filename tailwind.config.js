/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
        fontFamily: {
            'itc': ['ITC', 'monospace'],
            'berlingske': ['Berlingske', 'monospace'],
            'font': ['Font', 'monospace'],
            'toledo': ['Toledo', 'monospace'],
            'public': ['Public', 'monospace'],
            'eb-garamond': ['EB-Garamond', 'monospace'],
            'garamond': ['Garamond', 'monospace'],
            'bueno': ['Bueno', 'monospace'],
            'sabon': ['Sabon', 'monospace'],
            'avenir': ['Avenir', 'monospace'],
            'nunito': ['Nunito Sans', 'monospace'],
          },
    },
  },
  plugins: [],
}

