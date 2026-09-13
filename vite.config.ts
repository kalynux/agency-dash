import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  // ⚠ TWO DEPLOYMENT SHAPES NEED TWO DIFFERENT VALUES, AND MODE CANNOT TELL
  //   THEM APART.
  //
  //   Capacitor serves this bundle off the device filesystem, where there is no
  //   origin and only a RELATIVE base resolves. So './' is correct for every
  //   native build and must stay the default.
  //
  //   On the web it is wrong, and wrong in a way that appears only on a hard
  //   refresh of a deep link. index.html would reference ./assets/index-abc.js,
  //   which a browser sitting at C:/Program Files/Git/shipments/ID resolves against the current
  //   directory instead of the root. nginx's SPA fallback answers that missing
  //   path with index.html, the browser refuses to execute HTML as a module, and
  //   the page renders blank with a completely clean server log.
  //
  //   The mode flag is NOT the seam here: build:mobile already runs Vite in
  //   production mode, so the web release and the store release share it. An
  //   explicit variable is, and only the web container sets it (deploy/Dockerfile
  //   exports WEB_DEPLOY=1). Nothing else in this repository sets it, so every
  //   existing script keeps exactly the relative base it had before.
  base: process.env.WEB_DEPLOY === '1' ? '/' : './',
  // Load env files (.env, .env.development, *.local, …) from the ./env folder
  // instead of the project root. See env/README.md.
  envDir: path.resolve(__dirname, "env"),
  plugins: [inspectAttr(), react()],
    // Only ever scan the real app entry for dependency pre-bundling. Vite's
  // default is every *.html under the root, which sweeps in the Capacitor
  // sync output (android/app/src/main/assets/public/index.html and the Gradle
  // merged-assets copy) and tries to resolve imports out of an already-built
  // production bundle — e.g. framer-motion's optional @emotion/is-prop-valid.
  optimizeDeps: {
    entries: ["index.html"],
  },
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
