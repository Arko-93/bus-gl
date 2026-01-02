/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--text)',
        popover: 'var(--panel-solid)',
        'popover-foreground': 'var(--text)',
        border: 'var(--border)',
        accent: 'var(--hover, var(--bg))',
        'accent-foreground': 'var(--text)',
        muted: 'var(--bg)',
        'muted-foreground': 'var(--text-muted)',
        ring: 'var(--focus)',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
