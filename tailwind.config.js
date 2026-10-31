export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        void: '#04060d',
        deep: '#070b16',
        surface: '#0b1120',
        raised: '#101728',
        line: 'rgba(122, 154, 208, 0.14)',
        ink: {
          DEFAULT: '#e8eefb',
          muted: '#98a6c2',
          faint: '#64748b',
        },
        agent: {
          voice: '#22d3ee',
          intent: '#a78bfa',
          sentiment: '#34d399',
          objection: '#fbbf24',
          memory: '#60a5fa',
          action: '#2dd4bf',
        },
      },
      fontFamily: {
        sans: ['Inter Tight', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'ui-serif', 'Georgia', 'serif'],
      },
      letterSpacing: {
        widest: '0.22em',
      },
      boxShadow: {
        panel: '0 24px 60px -30px rgba(0, 0, 0, 0.9)',
        glow: '0 0 40px -8px var(--accent)',
      },
      transitionTimingFunction: {
        cinema: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
  plugins: [],
}
