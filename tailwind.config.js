/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — deep teal. 700 is the default: 4.8:1 on white, so it is safe
        // for body-sized text and for white text sitting on top of it.
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
          DEFAULT: "#0f766e",
          dark: "#115e59",
        },
        // Accent — amber, for "needs attention" states. Never use 400/500 for
        // text on white (fails AA); use 700+ or a tinted chip.
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          DEFAULT: "#f59e0b",
        },
        canvas: "#f1f5f9",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        // Lot codes, quantities, timestamps — anything meant to be compared
        // down a column reads better with consistent digit widths.
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        soft: "0 4px 16px -4px rgb(15 23 42 / 0.10)",
        pop: "0 10px 40px -8px rgb(15 23 42 / 0.20)",
        sheet: "0 -8px 40px -12px rgb(15 23 42 / 0.25)",
        fab: "0 8px 24px -6px rgb(15 118 110 / 0.5)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Bottom sheets travel their whole height so the gesture reads as
        // "the panel came up from the edge I swiped from".
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
        "sheet-up": "sheet-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
