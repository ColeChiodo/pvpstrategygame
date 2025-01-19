/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,jsx,ts,tsx,ejs}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"VT323"', 'monospace'],
      },
      colors: {
        'primary': '#222034',
        'secondary': '#45283c',
      },
      fontSize: {
        xs: '15px',    // Set the font size for xs to 10px
        sm: '20px',    // Set the font size for sm to 20px
        base: '30px',  // Default base font size (you can leave it or change)
        md: '30px',
        lg: '40px',    // Set the font size for lg to 24px
        xl: '50px',    // Set the font size for xl to 32px
        '2xl': '60px', // Set the font size for 2xl to 40px
        '3xl': '70px', // Set the font size for 3xl to 48px
        '4xl': '80px', // Set the font size for 4xl to 56px
        '5xl': '90px', // Set the font size for 5xl to 64px
        '6xl': '100px', // Set the font size for 6xl to 72px
        '7xl': '110px', // Set the font size for 7xl to 80px
      },
    },
    fontFamily: {
      sans: ['"VT323"', 'monospace'],
    },
  },
  plugins: [],
};
