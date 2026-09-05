import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `android` holds generated output, not source: the web bundle copied in by
  // `cap sync`, Capacitor's own native-bridge.js, and Gradle's intermediates.
  // Linting it means the problem count moves every time the app is synced or
  // built, which destroys the only signal this command has — "did my change add
  // anything?". The Android sources that ARE ours are Java/XML and unlintable
  // here anyway.
  globalIgnores(['dist', 'android']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
