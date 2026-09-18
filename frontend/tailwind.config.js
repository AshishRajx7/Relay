/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        relay: {
          bg: '#0D1117',            // Slate-based Base
          card: '#161F2C',          // Slate-based Surface
          'card-hover': '#1E293B',  // Slate-based Elevated
          elevated: '#1E293B',
          border: 'rgba(148, 163, 184, 0.12)',
          'border-light': 'rgba(148, 163, 184, 0.22)',
          accent: '#C8F25C',
          'accent-hover': '#B8E24C',
          'accent-muted': 'rgba(200, 242, 92, 0.12)',
          text: '#F8FAFC',          // Slate-50
          muted: '#94A3B8',         // Slate-400
          subtle: '#64748B',        // Slate-500
          success: '#A3E635',
          warning: '#FBBF24',
          danger: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'operator': '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.2)',
        'operator-lg': '0 12px 32px -4px rgba(0, 0, 0, 0.5), 0 4px 12px -2px rgba(0, 0, 0, 0.3)',
        'dock': '0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(148, 163, 184, 0.15)',
      }
    },
  },
  plugins: [],
}
