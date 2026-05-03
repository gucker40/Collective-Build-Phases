module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#030305",
          900: "#050508",
          800: "#08080f",
          700: "#0a0a14",
          600: "#0f0f1e",
          500: "#141428",
        },
        logos: {
          gold: "#d4af37",
          "gold-dim": "#a07c1a",
          purple: "#7c3aed",
          "purple-bright": "#8b5cf6",
          "purple-deep": "#4c1d95",
          "purple-glow": "#6b21a8",
          ethereal: "#e8e0ff",
          mist: "#a09ab8",
        },
      },
      fontFamily: {
        logos: ["'Cinzel'", "serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
