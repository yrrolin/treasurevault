# TreasureVault

A personal editing-asset library for keeping project files, footage, b-roll, transitions, sound effects and music searchable in one place.

## Stack
- React + Vite
- Supabase for asset metadata, authentication and search
- Google Drive for original media storage
- GitHub Actions for static deployment

## Run locally
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
4. Run `npm run dev`.

## Deployment
The workflow in `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on pushes to `main`.

Set these repository Actions variables under **Settings → Secrets and variables → Actions → Variables**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (the Supabase publishable key is safe for browser use)

These are public frontend configuration values. Never put a Supabase secret/service-role key, database password or Google OAuth client secret in this repository.

## Current build
This commit establishes the interface and project foundation. The displayed assets are sample content until Drive and Supabase integrations are connected. The next stages are database schema and row-level security, Google Drive OAuth, asset ingestion and semantic search.
