/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        azure: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffe',
          300: '#7cc2fd',
          400: '#36a2fa',
          500: '#0078d4', // Official Azure Blue
          600: '#0062b0',
          700: '#004e8c',
          800: '#054273',
          900: '#0a3861',
        },
      },
    },
  },
  plugins: [],
}

