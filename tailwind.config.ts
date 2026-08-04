import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e11d48",
          50: "#fff1f3",
          100: "#ffe4e9",
          600: "#e11d48",
          700: "#be123c",
        },
        ink: {
          DEFAULT: "#0f172a",
          muted: "#64748b",
          soft: "#94a3b8",
        },
        surface: {
          DEFAULT: "#ffffff",
          page: "#f6f7f9",
          hover: "#f1f5f9",
        },
        line: "#e7eaee",
      },
      fontFamily: {
        sans: ["var(--font-app)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        pop: "0 8px 30px rgba(15,23,42,0.12)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)", maxHeight: "0" },
          "100%": { opacity: "1", transform: "translateY(0)", maxHeight: "600px" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(16,185,129,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease both",
        "pop-in": "pop-in 0.3s ease both",
        "slide-down": "slide-down 0.35s ease both",
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
