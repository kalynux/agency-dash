import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // Load env files (.env, .env.development, *.local, …) from the ./env folder
  // instead of the project root. See env/README.md.
  envDir: path.resolve(__dirname, "env"),
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true, // Exit if port 5174 is already in use
  },
});
