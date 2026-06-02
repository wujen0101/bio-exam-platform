/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2E7D32',    // 主色：深綠（醫學感）
        secondary: '#1565C0',  // 副色：深藍
        accent: '#F57F17',     // 強調：橘黃（重點提示）
      }
    },
  },
  plugins: [],
}
