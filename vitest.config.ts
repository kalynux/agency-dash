import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Test config, kept separate from `vite.config.ts` on purpose.
 *
 * The app build is the control group for the whole Capacitor migration
 * (CAPACITOR-PLAN.md ground rule 3), so the config that produces it stays
 * untouched. Nothing here loads the React plugin or the inspector: these tests
 * are pure logic — no components, no JSDOM, no network. See P1.12.
 */
export default defineConfig({
    resolve: {
        // Mirrors vite.config.ts. Without it every `@/…` import in a test fails
        // to resolve, since we deliberately do not extend the app config.
        alias: { '@': path.resolve(__dirname, './src') },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
