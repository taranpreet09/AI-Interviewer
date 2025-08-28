// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        'fade-in-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'typing-dot': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'fade-in-slide-up': 'fade-in-slide-up 0.5s ease-out forwards',
        'typing-dot-1': 'typing-dot 1s infinite 0s',
        'typing-dot-2': 'typing-dot 1s infinite 0.2s',
        'typing-dot-3': 'typing-dot 1s infinite 0.4s',
      },
    },
  },
  plugins: [],
};