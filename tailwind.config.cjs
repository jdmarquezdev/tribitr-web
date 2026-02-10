module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        leaf: {
          50: "#f2fbf4",
          100: "#def6e5",
          200: "#bcebc8",
          300: "#93dca7",
          400: "#5fc57b",
          500: "#3cab5f",
          600: "#2e8e4c",
          700: "#256f3d",
          800: "#205834",
          900: "#1b482c"
        },
        moss: {
          100: "#f6f3e7",
          200: "#e7dfc5",
          300: "#d7c69f",
          400: "#c2a96f"
        }
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Work Sans", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 50px -20px rgba(27, 72, 44, 0.45)",
        lift: "0 12px 30px -16px rgba(32, 88, 52, 0.6)"
      }
    }
  },
  plugins: []
}
