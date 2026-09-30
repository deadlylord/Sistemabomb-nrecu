module.exports = {
  content: ['./index.html', './*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './services/**/*.{js,jsx,ts,tsx}'],
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            'primary': '#020617',    // slate-950
            'secondary': '#0f172a',  // slate-900
            'accent': 'rgb(var(--color-accent) / <alpha-value>)',
            'accent-hover': 'rgb(var(--color-accent-hover) / <alpha-value>)',
            'accent-secondary': 'rgb(var(--color-accent-secondary) / <alpha-value>)',
            'light': '#f8fafc',      // slate-50
            'text-light': '#e2e8f0', // slate-200
            'text-dark': '#94a3b8',  // slate-400
          },
          boxShadow: {
            'accent': '0 0 25px rgb(var(--color-accent) / 0.6)',
          },
           animation: {
            'fade-in': 'fade-in 0.3s ease-out forwards',
            'slide-up': 'slide-up 0.3s ease-out forwards',
            'pulse-accent': 'pulse-accent 0.7s ease-out',
            'fade-in-out': 'fade-in-out 3s ease-in-out forwards',
            blob: 'blob 7s infinite',
          },
          keyframes: {
            'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
            'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
            'pulse-accent': {
                '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' },
                '50%': { transform: 'scale(1.05)', boxShadow: '0 0 15px rgb(var(--color-accent) / 0.7)' }
            },
            'fade-in-out': {
                '0%': { opacity: '0', transform: 'translateY(20px)' },
                '10%, 90%': { opacity: '1', transform: 'translateY(0)' },
                '100%': { opacity: '0', transform: 'translateY(20px)' }
            },
            blob: {
              '0%': { transform: 'translate(0px, 0px) scale(1)' },
              '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
              '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
              '100%': { transform: 'translate(0px, 0px) scale(1)' },
            },
          },
        }
      }
    };
