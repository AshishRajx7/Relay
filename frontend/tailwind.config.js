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
          bg: '#060B14',
          card: '#0B1220',
          'card-hover': '#0F182B',
          border: '#1B2638',
          'border-light': '#243249',
          accent: '#C8F25C',
          'accent-hover': '#B6DF4D',
          'accent-muted': 'rgba(200, 242, 92, 0.12)',
          success: '#A3E635',
          'success-muted': 'rgba(163, 230, 53, 0.12)',
          warning: '#FBBF24',
          'warning-muted': 'rgba(251, 191, 36, 0.12)',
          danger: '#EF4444',
          'danger-muted': 'rgba(239, 68, 68, 0.12)',
          text: '#FFFFFF',
          muted: '#A8B3C7',
          subtle: '#64748B',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'operator': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
        'operator-lg': '0 4px 12px 0 rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
