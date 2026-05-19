# Phase 1: TypeScript Foundation & Build Pipeline - Context

**Gathered:** 2026-03-30  
**Status:** Ready for planning  
**Source:** Project initialization with typescript-rewrite.md specification

## Phase Boundary

Phase 1 establishes the TypeScript infrastructure for the entire v2.0 migration. This is the foundation phase — all downstream phases depend on a working TS build pipeline with strict mode enabled and proper handling of existing JavaScript code during transition.

**Deliverables:**
- TypeScript 5.x strict mode enabled across the project
- Vite + tsc build pipeline compiling `.ts` files successfully
- Existing `.js` files coexist during transition (allowJs)
- Zero TS errors in strict mode
- Dev server with hot reload fully functional
- Source maps for debugging in dev
- ESLint configured with TypeScript support
- Type declaration files (.d.ts) for Three.js, Rapier3D, WebSocket
- No performance regression vs current baseline

## Implementation Decisions

### TypeScript Configuration
- **Target:** ES2020 (modern browsers, current Vite supports)
- **Module:** ESNext (let Vite handle bundling)
- **Strict mode:** ALL enabled (strict, noImplicitAny, noImplicitThis, strictNullChecks, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, alwaysStrict, noImplicitReturns, noFallthroughCasesInSwitch, noUncheckedIndexedAccess)
- **skipLibCheck:** false (verify type definitions)
- **allowJs:** true (during transition, coexist with .js files)
- **checkJs:** false (don't check .js files yet)
- **outDir:** dist (handled by Vite)
- **declaration:** true (generate .d.ts for exports)
- **sourceMap:** true (debug support)

### Build Pipeline
- **Incremental compilation:** enabled (faster rebuilds)
- **Build tool:** Keep Vite (already optimized)
- **Bundle chunks:** Keep Three.js and Rapier3D as separate chunks (from current config, verify no regression)
- **Minification:** Terser (current)
- **Vite config updates:** No breaking changes, add TS support without affecting existing optimization

### Linting & Code Quality
- **ESLint:** Install + configure with `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
- **Rules:** TypeScript-specific rules to catch type errors, unused variables, etc.
- **Pre-commit:** NO git hooks or linting gates (focus is compilation success, not style)
- **tsconfig.json:** Single source of truth for TS config (no separate tsconfig files per package yet)

### Package.json Updates
- **scripts.build:** Keep existing (Vite handles TS now)
- **scripts.dev:** Keep hot reload, verify it works with .ts files
- **devDependencies:** Add: typescript@5.x, ts-node (~11), @types/node@latest, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, eslint
- **Allow coexistence:** Don't remove babel or any JS tooling yet (gradual transition)

### Type Declaration Files
- **Skip manual .d.ts files for now** — Use `skipLibCheck: false` to verify existing type definitions from npm packages
- **Three.js types:** Included in npm package (@types builtin)
- **Rapier3D types:** Included in npm package
- **WebSocket types:** Use Node types (@types/node)
- **Future:** Only create custom .d.ts if external integrations lack types

### Acceptance Criteria
- `npm run build` executes with 0 TS errors (strict mode)
- `npm run dev` starts dev server and recompiles .ts changes with hot reload (typically <5s)
- Type checking passes on all .ts files
- No build-time performance regression vs current baseline (measure: build time, bundle size)
- IDE (VS Code) recognizes .ts files with full IntelliSense
- Existing .js files don't block TS compilation (allowJs working)
- ESLint runs without breaking the build

## the Agent's Discretion

- **Build optimization:** If incremental compilation shows < 5% performance improvement, consider disabling
- **Linting strictness:** ESLint rule set can be tuned based on initial violations found (e.g., if team prefers relaxed unused-vars)
- **ts-node usage:** Only needed if scripts/ directory exists with Node scripts; can defer if not used yet
- **Error reporting:** How errors are displayed in CI/IDE can be tuned (currently recommending stderr focus)

## Canonical References

**Mandatory reading for downstream agents:**

- [PROJECT.md](../../PROJECT.md) — Technology decisions, architecture patterns, scope constraints
- [REQUIREMENTS.md](../../REQUIREMENTS.md) — Validated capabilities (existing game), active requirements (TS features)
- [tsconfig.json Template](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) — Reference for available TS config options
- [Vite + TypeScript Guide](https://vitejs.dev/guide/features.html#typescript) — How Vite integrates TS
- [ESLint TypeScript Plugin](https://github.com/typescript-eslint/typescript-eslint) — Plugin configuration

## Implementation Specifics

### File Locations
- `tsconfig.json` — Project root
- `.eslintrc.json` (or .eslintrc.cjs) — Project root
- `.eslintignore` — Project root (ignore node_modules, dist, .planning)
- `vite.config.js` — Already exists, may need light updates for TS awareness
- `src/` — Entry point includes `.ts` files during transition

### Key Metrics to Preserve
- **Bundle size:** Three.js chunk + Rapier3D chunk from vite.config.js optimization
- **Dev build time:** Current baseline (typical: 2-5s for full rebuild)
- **Hot reload time:** Current baseline (typically: <1s update)

### Transition Strategy
- **Phase 1 output:** TS build working, no enforcement yet (allow .js alongside .ts)
- **Phase 2 onward:** Gradually migrate .js → .ts, maintain zero-error state
- **Final state:** 100% .ts, remove allowJs

## Deferred Ideas

- **Monorepo structure** (pnpm workspaces) — v2.1+, after core migration complete
- **Separate tsconfig per package** — When monorepo added
- **Pre-commit linting gates** — Post-foundation (Phase 6)
- **Type-heavy validation (Zod, tRPC)** — Phase 2+
- **Storybook + TypeScript** — UI testing phase, later

---

**Phase: 01-typescript-foundation**  
**Context gathered:** 2026-03-30 at planning initialization
