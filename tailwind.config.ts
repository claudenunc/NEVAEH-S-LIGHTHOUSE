import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0A0A',
          secondary: '#111111',
          card: 'rgba(255,255,255,0.03)',
          'card-hover': 'rgba(255,255,255,0.06)'
        },
        border: {
          subtle: 'rgba(255,255,255,0.08)',
          glow: 'rgba(191,64,255,0.3)'
        },
        accent: {
          primary: '#BF40FF',
          'primary-glow': 'rgba(191,64,255,0.15)',
          secondary: '#00D4FF',
          warm: '#FF6B6B'
        },
        text: {
          primary: '#F0F0F0',
          secondary: '#888888',
          muted: '#555555'
        }
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      backdropBlur: { xs: '2px' },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
} satisfies Config
