import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#FFE500",
          yellowHover: "#E6CE00",
          yellowLight: "#FFF9C4",
          black: "#0F172A",
          charcoal: "#1E293B",
          surface: "#F8F9FA",
          card: "#FFFFFF",
          border: "#E2E8F0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px -3px rgba(255, 229, 0, 0.4)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
