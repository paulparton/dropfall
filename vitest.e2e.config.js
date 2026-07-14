import { defineConfig } from 'vitest/config';

// Dedicated config for the headless-browser e2e suite.
//
// Why a separate config: in vitest 4.x the CLI positional arg is a *filter*
// applied on top of the `include` glob, NOT an override of it. The base
// vitest.config.js uses `include: ['tests/**/*.test.{js,ts}']`, so a file
// named `game.e2e.js` would never be picked up by `vitest run <path>` alone.
// This config narrows `include` to just the e2e file so `npm run test:e2e`
// runs it, while `npm test` (which uses vitest.config.js) stays unchanged
// and never launches a browser. The per-file `// @vitest-environment node`
// pragma in tests/e2e/game.e2e.js still overrides the environment per-file.
export default defineConfig({
    test: {
        include: ['tests/e2e/game.e2e.js'],
        environment: 'node',
    },
});
