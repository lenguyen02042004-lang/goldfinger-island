import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        skyGame: "#30b9f2",
        ocean: "#168bd2",
        grass: "#63bd43",
        grassDark: "#318d3c",
        sun: "#ffd33d",
        orangeGame: "#ff8a2b",
        ink: "#17324d",
        coral: "#f25f5c"
      },
      boxShadow: {
        game: "0 5px 0 rgba(23, 50, 77, 0.18), 0 10px 24px rgba(23, 50, 77, 0.12)",
        button: "0 5px 0 rgba(132, 76, 8, 0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
