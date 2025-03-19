/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,jsx,ts,tsx,ejs}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Rubik"', 'serif'],
      },
      colors: {
        'primary': '#0f0f2b',
        'secondary': '#222034',
      },
      fontSize: {
        xs: '10px',
        sm: '15px',
        base: '20px',
        md: '20px',
        lg: '25px',
        xl: '30px',
        '2xl': '35px',
        '3xl': '40px',
        '4xl': '45px',
        '5xl': '50px', 
        '6xl': '55px',
        '7xl': '60px',
      },
    },
    fontFamily: {
      sans: ['"Rubik"', 'serif'],
    },
  },
  plugins: [],
};
