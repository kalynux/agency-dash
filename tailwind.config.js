/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Sora"', '"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        numeric: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Brand ramp — emerald centered on #0E9F6E. Use for gradients, tints and
        // large decorative fills; the semantic `primary` above owns AA-critical text.
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#0e9f6e",
          600: "#0b8a5f",
          700: "#0a6f4d",
          800: "#0a563d",
          900: "#0a4733",
          950: "#03271c",
          DEFAULT: "#0e9f6e",
        },
        // Gold — value, attention, positive money highlights.
        gold: {
          50: "#fef6e7",
          100: "#fce9bf",
          200: "#f8d78a",
          400: "#f4b740",
          500: "#eaa916",
          600: "#c6870f",
          700: "#9a6a0e",
          DEFAULT: "#f4b740",
        },
        // Signal blue — logistics / in-transit accents.
        info: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      borderRadius: {
        "2xl": "calc(var(--radius) + 8px)",
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(6 36 26 / 0.06)",
        sm: "0 1px 2px 0 rgb(6 36 26 / 0.06), 0 1px 3px 0 rgb(6 36 26 / 0.05)",
        DEFAULT: "0 1px 3px 0 rgb(6 36 26 / 0.08), 0 1px 2px -1px rgb(6 36 26 / 0.06)",
        md: "0 4px 8px -2px rgb(6 36 26 / 0.10), 0 2px 4px -2px rgb(6 36 26 / 0.06)",
        lg: "0 12px 24px -8px rgb(6 36 26 / 0.14), 0 4px 8px -4px rgb(6 36 26 / 0.08)",
        xl: "0 24px 48px -12px rgb(6 36 26 / 0.20), 0 8px 16px -8px rgb(6 36 26 / 0.10)",
        // Emerald lift for the primary action / FAB / hero metric.
        brand: "0 12px 28px -10px rgb(14 159 110 / 0.50), 0 4px 10px -6px rgb(14 159 110 / 0.40)",
        "brand-sm": "0 6px 16px -8px rgb(14 159 110 / 0.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, hsl(158 84% 30%) 0%, hsl(150 80% 22%) 100%)",
        "brand-sheen": "radial-gradient(120% 120% at 100% 0%, rgb(52 211 153 / 0.28) 0%, transparent 55%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.96)", opacity: "0.6" },
          "60%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        rise: "rise 0.5s cubic-bezier(0.16,1,0.3,1) both",
        pop: "pop 0.28s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
