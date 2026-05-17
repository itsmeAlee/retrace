import type { Config } from "tailwindcss";

export const retraceTheme = {
  colors: {
    bg: "#F7F6F3",
    surface: "#FFFFFF",
    primary: "#1A3C34",
    accent: "#D4A843",
    "text-primary": "#111111",
    "text-muted": "#6B6B6B",
    border: "#E4E2DC",
    error: "#C0392B",
    success: "#27AE60",
    "primary-hover": "#0F2D25",
    "border-hover": "#C8C5BE",
    "draft-text": "#92700A",
    "surface-hover": "#FAFAF8",
    "neutral-soft": "#F0EEE9"
  },
  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    "label-gap": "6px",
    7: "28px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
    sidebar: "220px",
    "auth-form": "400px",
    "auth-left-min": "480px",
    modal: "480px",
    settings: "560px",
    "detail-panel": "280px",
    "session-card": "260px",
    "auth-control": "48px",
    "secondary-control": "36px",
    "icon-lg": "40px",
    "icon-md": "36px",
    indicator: "16px",
    "otp-w": "52px",
    "otp-h": "60px",
    "bottom-tab": "60px"
  },
  radius: {
    note: "6px",
    form: "8px",
    row: "10px",
    card: "12px",
    modal: "16px",
    pill: "999px"
  },
  shadows: {
    card: "0 1px 3px rgba(0,0,0,0.06)",
    "card-hover": "0 4px 16px rgba(0,0,0,0.10)",
    focus: "0 0 0 3px rgba(26,60,52,0.10)",
    "error-focus": "0 0 0 3px rgba(192,57,43,0.10)"
  }
} as const;

const config = {
  theme: {
    extend: {
      colors: retraceTheme.colors,
      spacing: retraceTheme.spacing,
      borderRadius: retraceTheme.radius,
      boxShadow: retraceTheme.shadows,
      fontFamily: {
        heading: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"]
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.2" }],
        sm: ["13px", { lineHeight: "1.2" }],
        base: ["15px", { lineHeight: "1.65" }],
        md: ["16px", { lineHeight: "1.65" }],
        lg: ["18px", { lineHeight: "1.4" }],
        xl: ["24px", { lineHeight: "1.15" }],
        "auth-heading": ["28px", { lineHeight: "1.15" }],
        display: ["clamp(2rem, 3.5vw, 2.75rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        greeting: ["clamp(2rem, 3vw, 2.5rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }]
      }
    }
  }
} satisfies Config;

export default config;
