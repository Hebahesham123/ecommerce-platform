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
    },
  },
  plugins: [],
};

export default config;
