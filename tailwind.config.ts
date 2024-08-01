import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  important: true,
  mode: 'jit',
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      padding: {
        '1/2': '50%',
        full: '100%',
      },
      colors: {
        'liberula-yellow': '#F6C400',
      },
    },
    fontFamily: {
      sans: ['Open Sans', 'sans-serif'],
      serif: ['Merriweather', 'serif'],
      title :['Open Sans', 'ui-sans-serif'],
      normal :['Roboto', 'sans-serif']
    },
    screens: {
      'mobile-s': '320px',
      'mobile-m': '375px',
      'mobile-l': '425px',
      'tablet': '768px',
      'laptop': '1024px',
      'laptop-l': '1440px',
      'desktop': '2560px',
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
};
export default config;
