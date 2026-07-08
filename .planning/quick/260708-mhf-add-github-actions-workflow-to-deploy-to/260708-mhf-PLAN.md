---
quick_id: 260708-mhf
slug: add-github-actions-workflow-to-deploy-to
description: Add GitHub Actions workflow to deploy to Railway
date: 2026-07-08
status: complete
---

# Quick Task 260708-mhf: Add GitHub Actions workflow to deploy to Railway

## Task

Because the Railway GitHub integration is connected to a different GitHub account, add a GitHub Actions workflow that deploys the project to Railway on every push to `main` using the Railway CLI deploy action.

## Plan

1. Create `.github/workflows/deploy.yml`.
2. Configure it to trigger on pushes to `main`.
3. Set up Node.js 20, install dependencies, run tests.
4. Use `railwayapp/deploy-action@v1` with `RAILWAY_TOKEN` from repository secrets.

## Files

- `.github/workflows/deploy.yml`
