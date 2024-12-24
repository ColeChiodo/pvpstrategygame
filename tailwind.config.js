/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx,ejs}"
    ],
    theme: {
      extend: {},
    },
    plugins: [
      require('daisyui')
    ],
    daisyui: {
      themes: [
        {
          mytheme: {
            
          },
        }
      ]
    }
  }
  
  