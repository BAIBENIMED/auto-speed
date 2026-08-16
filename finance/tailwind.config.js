/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        surface: "#ffffff",
        "surface-subtle": "#f1f5f9",
        "surface-hover": "#e2e8f0",
        primary: "#1e40af",
        "primary-container": "#dbeafe",
        "on-primary-container": "#1e3a8a",
        secondary: "#059669",
        "secondary-container": "#d1fae5",
        "on-secondary-container": "#065f46",
        tertiary: "#d97706",
        error: "#dc2626",
        "error-container": "#fee2e2",
        "on-error-container": "#991b1b",
        "on-surface": "#0f172a",
        "on-surface-variant": "#475569",
        outline: "#cbd5e1",
        "outline-variant": "#e2e8f0"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem"
      },
      fontFamily: {
        "headline-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "data-lg": ["JetBrains Mono", "monospace"],
        "data-sm": ["JetBrains Mono", "monospace"],
        "label-caps": ["Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
}
