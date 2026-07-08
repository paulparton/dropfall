---
quick_id: 260708-mhf
slug: add-github-actions-workflow-to-deploy-to
status: complete
date: 2026-07-08
---

# Quick Task 260708-mhf Summary

## What changed

Added `.github/workflows/deploy.yml` to deploy to Railway via GitHub Actions instead of Railway's native GitHub integration (which is connected to a different account).

Workflow steps:
1. Checkout repository (`actions/checkout@v4`).
2. Setup Node.js 20 (`actions/setup-node@v4`).
3. Install dependencies with `npm ci`.
4. Run tests with `npm run test`.
5. Deploy to Railway using `railwayapp/deploy-action@v1`.

## Required repository secret

- `RAILWAY_TOKEN` — a Railway project token with deploy permissions.
  - Generate it in Railway: Project Settings → Tokens → New Token.
  - Add it to GitHub: Settings → Secrets and variables → Actions → New repository secret.

## Files changed

- `.github/workflows/deploy.yml`

## Notes

- The workflow only deploys on pushes to `main`.
- Tests must pass before deployment is attempted.
- The action uses the committed `railway.json` for build/start configuration.
