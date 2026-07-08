---
quick_id: 260708-m3g
slug: fix-railway-build-ebusy-node-modules-cac
status: complete
date: 2026-07-08
---

# Quick Task 260708-m3g Summary

## What changed

Fixed two Railway build issues:

1. **`railway.json` build command:** Changed from `npm ci && npm run build` to just `npm run build`. Railway/Nixpacks already runs `npm ci` as the install step; running it again in the build step caused `EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'` because the cache mount was still active.

2. **`package.json` Node engine:** Added `"engines": { "node": ">=20.0.0" }`. The build logs showed `EBADENGINE` warnings because Nixpacks defaulted to Node 18, but dependencies like Vite, Vitest, and jsdom require Node 20+.

## Files changed

- `railway.json`
- `package.json`

## Verification

- `npm run test` — 233 tests pass
- `npm run build` — succeeds

## Notes

- The `start:prod` command still copies `dist/*` to `server/public/` and runs the server; it relies on the build step having produced `dist/`.
- No `VITE_WS_URL` env var is needed for same-origin deployment.
