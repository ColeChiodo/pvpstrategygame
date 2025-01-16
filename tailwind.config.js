/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,jsx,ts,tsx,ejs}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        'primary': '#222034',
        'secondary': '#45283c',
      },
    },
    fontFamily: {
      sans: ['"Press Start 2P"', 'monospace'],
    },
  },
  plugins: [],
};
