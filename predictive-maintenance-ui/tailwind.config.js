/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        panel: '#111827',
        line: 'rgba(148, 163, 184, 0.16)',
        accent: {
          DEFAULT: '#8b5cf6',
          soft: '#a78bfa',
          pink: '#ec4899',
          cyan: '#22d3ee'
        }
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139,92,246,0.15), 0 12px 40px rgba(139,92,246,0.18)',
        soft: '0 14px 40px rgba(15, 23, 42, 0.35)'
      },
      backdropBlur: {
        xs: '2px'
      },
      backgroundImage: {
        grid: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)'
      },
      animation: {
        pulseGlow: 'pulseGlow 2.2s ease-in-out infinite'
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.28)' },
          '50%': { boxShadow: '0 0 0 10px rgba(139, 92, 246, 0)' }
        }
      }
    }
  },
  plugins: []
}
