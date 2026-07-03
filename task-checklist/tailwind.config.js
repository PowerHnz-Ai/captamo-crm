/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './auth.html',
    './app.js',
    './auth.js'
  ],
  // Estratégia de "important" por seletor: os utilitários são gerados como
  // `html .classe { ... }`, ganhando especificidade suficiente para vencer o
  // styles.css legado SEM usar !important. O seletor `html` cobre o próprio
  // <body> e todos os descendentes, inclusive diálogos/toasts criados via JS.
  important: 'html',
  // Evita falso positivo: o scanner captura `!container` de `if (!container)`
  // no JS e geraria uma classe `.!container` com !important sem uso real.
  blocklist: ['!container'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          card: 'var(--bg-card)',
          border: 'var(--border)',
          text: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-secondary)',
          accent: 'var(--accent)',
          accentHover: 'var(--accent-hover)'
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        ultra: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        app: '0 10px 30px rgba(0,0,0,0.25)'
      }
    }
  },
  plugins: []
};
