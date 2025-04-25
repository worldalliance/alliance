const usedColors = ['blue', 'red', 'green', 'stone']

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
        fontFamily: {
            'newsreader': ['Newsreader', 'monospace'],
            'itc': ['ITC', 'monospace'],
            'berlingske': ['Berlingske', 'monospace'],
            'font': ['Font', 'monospace'],
            'toledo': ['Toledo', 'monospace'],
            'public': ['Public', 'monospace'],
            'eb-garamond': ['EB-Garamond', 'monospace'],
            'garamond': ['Garamond', 'monospace'],
            'bueno': ['Bueno', 'monospace'],
            'sabon': ['Sabon', 'monospace'],
            'avenir': ['Newsreader', 'monospace'],
            'nunito': ['Nunito Sans', 'monospace'],
          },
    },
  },
  safelist: usedColors.map((c) => `bg-${c}-500`),
  plugins: [],
}
