import type { Config } from "tailwindcss";

export const retraceTheme = {
  colors: {
    background: "#F7F6F3",
    surface: "#FFFFFF",
    primary: "#1A3C34",
    secondary: "#D4A843",
    textPrimary: "#111111",
    textSecondary: "#6B6B6B",
    border: "#E4E2DC"
  }
} as const;

const config = {
  theme: {
    extend: {
      colors: retraceTheme.colors
    }
  }
} satisfies Config;

export default config;
