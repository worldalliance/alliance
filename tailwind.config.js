/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
        fontFamily: {
            'itc': ['ITC', 'monospace'],
            'itc-bold': ['ITC-Bold', 'monospace'],
            'berlingske': ['Berlingske', 'monospace'],
            'font': ['Font', 'monospace'],
            'toledo': ['Toledo', 'monospace'],
            'public': ['Public', 'monospace'],
            'eb-garamond': ['EB-Garamond', 'monospace'],
            'garamond': ['Garamond', 'monospace'],
            'bueno': ['Bueno', 'monospace'],
          },
    },
  },
  plugins: [],
}

