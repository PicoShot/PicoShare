/** @type {import('tailwindcss').Config} */

const { heroui } = require("@heroui/react");

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#121212",
        surface: "#1E1E1E",
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};
