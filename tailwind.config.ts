import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Surfaces — deep near-black with a faint blue-violet tint.
        bg: {
          void: '#060709',
          base: '#0a0b0f',
          panel: '#0f1117',
          card: '#14171f',
          raised: '#1b1f29',
          hover: '#222734',
        },
        edge: {
          DEFAULT: '#232936',
          strong: '#323a4b',
          faint: '#191e28',
        },
        ink: {
          primary: '#eef1f6',
          secondary: '#99a2b3',
          muted: '#5c6577',
          faint: '#39414f',
        },
        // Status accents — restrained, high-contrast.
        accent: {
          green: '#34e89e',   // confirmed
          amber: '#f5b454',   // pending
          red: '#ff5d73',     // failed / Vader
          cyan: '#4cc4f0',    // info / http
          violet: '#a98bf5',  // native / special
        },
        // The two machines (light side / dark side).
        yoda: '#34e89e',
        vader: '#ff5d73',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(52,232,158,0.15), 0 0 24px -4px rgba(52,232,158,0.25)',
        'glow-red': '0 0 0 1px rgba(255,93,115,0.15), 0 0 24px -4px rgba(255,93,115,0.25)',
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'flow': 'flow 1.6s linear infinite',
        'dash': 'dash 1.2s linear infinite',
      },
      keyframes: {
        flow: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '200% 0%' },
        },
        dash: {
          to: { strokeDashoffset: '-16' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
