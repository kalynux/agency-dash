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

  // ─── react-refresh/only-export-components ──────────────────────────────────
  //
  // The rule is right in general and stays on for the whole app: a page or a
  // feature component that also exports a helper silently loses hot reload, and
  // that is worth being told about.
  //
  // It is switched off for exactly two families, because in both the mixed
  // export is the correct structure and the alternative is worse:
  //
  //   1. `components/ui/*` — shadcn components export their `cva` variant object
  //      (`buttonVariants`, `badgeVariants`) beside the component. That is
  //      upstream's public API, and these files are re-syncable with
  //      `npx shadcn add <name>`; rewriting them to satisfy a lint rule would
  //      turn every future re-sync into a manual merge.
  //
  //   2. Context stores, and the app shell that defines two of its own — a
  //      Provider component and the `useX()` hook that reads it belong in one
  //      file because they share a module-private `Context` object. Splitting
  //      them means EXPORTING that context so the hook's new home can import it,
  //      which widens the surface that must not be used directly. The cost of
  //      leaving them together is bounded and known: editing a store file
  //      full-reloads instead of hot-reloading.
  //
  // Anything else that trips this rule is a real finding — fix the file, do not
  // extend these globs.
  {
    files: [
      'src/components/ui/*.{ts,tsx}',
      'src/store/*.{ts,tsx}',
      'src/onboarding/store/*.{ts,tsx}',
      'src/onboarding/OnboardingLayout.tsx',
      'src/App.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
