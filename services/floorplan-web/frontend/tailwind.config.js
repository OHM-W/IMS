/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'isa-run': '#00FF87',
        'isa-idle': '#FFB800',
        'isa-alarm': '#FF003C',
        'isa-loto': '#00F2FE',
        'isa-off': '#64748B',
        'factory-bg': '#0B0F19',
        'factory-panel': '#111827',
        'factory-card': '#1E293B',
        'factory-border': '#334155',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-alarm': 'pulseAlarm 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-run': 'glowRun 2s ease-in-out infinite alternate',
      },
      keyframes: {
        pulseAlarm: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(255, 0, 60, 0.8), inset 0 0 15px rgba(255, 0, 60, 0.4)',
            borderColor: '#FF003C',
          },
          '50%': {
            boxShadow: '0 0 5px rgba(255, 0, 60, 0.3)',
            borderColor: 'rgba(255, 0, 60, 0.4)',
          },
        },
        glowRun: {
          '0%': {
            boxShadow: '0 0 8px rgba(0, 255, 135, 0.3)',
          },
          '100%': {
            boxShadow: '0 0 16px rgba(0, 255, 135, 0.6)',
          },
        },
      },
    },
  },
  plugins: [],
}
