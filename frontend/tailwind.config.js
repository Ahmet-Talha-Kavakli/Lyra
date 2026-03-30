/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0f0ff',
          200: '#bae0ff',
          300: '#7fc9ff',
          400: '#36b0ff',
          500: '#0b8cff',
          600: '#0073e6',
          700: '#005acc',
          800: '#0047a3',
          900: '#003d82',
        },
        therapy: {
          calming: '#e8f4f8',
          trust: '#f0e6ff',
          safe: '#e8f5e9',
          alert: '#fff3e0',
        }
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        fade: 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
