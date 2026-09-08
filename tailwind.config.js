// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        '3xl': '1920px', // For extra-wide screens where Learning Directory can expand
      },
      colors: {
        // Map CSS variables to Tailwind utilities
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        border: 'var(--color-border)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          text: 'var(--color-primary-text)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          text: 'var(--color-success-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          text: 'var(--color-warning-text)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          text: 'var(--color-error-text)',
        },
      },
      textColor: {
        'theme-primary': 'var(--color-text)',
        'theme-secondary': 'var(--color-text-secondary)',
      },
      borderColor: {
        theme: 'var(--color-border)',
      },
      backgroundColor: {
        theme: {
          background: 'var(--color-background)',
          surface: 'var(--color-surface)',
          'surface-hover': 'var(--color-surface-hover)',
        },
      },
      ringColor: {
        primary: 'var(--color-primary)',
      },
    },
  },
  plugins: [],
}