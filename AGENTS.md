# Repository guide for coding agents

## Project

This is a React 19, TypeScript, and Vite application. Supabase provides the
runtime database, authentication, and GPX storage; GitHub Actions deploys the
frontend to GitHub Pages.

- `src/features/`: UI and feature-specific behavior
- `src/domain/`: core domain types
- `src/data/`: data access and the legacy import catalog
- `src/shared/`: reusable domain helpers and formatting
- `supabase/migrations/`: forward-only database changes
- `public/routes/`: source GPX files used by the one-time catalog import

Follow nearby patterns and keep changes focused. User-facing text is German;
preserve that localization and existing accessible interaction patterns.

## Commands

- `npm ci`: install locked dependencies
- `npm run dev`: start the local Vite server
- `npm test`: run the Node test suite through `tsx`
- `npm run build`: run TypeScript checks and create the production build
- `npm run routes`: regenerate route-analysis data from `public/routes/`

Copy `.env.example` to `.env.local` for local Supabase configuration. Do not
invent credentials or include real credentials in changes, logs, or responses.

## Data and security safeguards

- Never put private credentials in `VITE_` variables; those are included in the
  browser build. Never expose a Supabase secret/service-role key.
- Do not run `npm run seed:supabase` unless explicitly requested. It is a
  one-time import and can overwrite managed tour records.
- Never edit an existing Supabase migration; add a new, higher-numbered
  migration. Migrations merged to `main` are automatically applied to the
  connected Supabase project.
- Preserve least-privilege grants and Row Level Security. Treat member profile,
  attendance, contact, and birthday data as private; do not log or expose it.
- `src/data/routes.generated.json` is ignored generated output. Do not edit it
  by hand; regenerate it with `npm run routes` when GPX source changes require
  updated analysis.

Run `npm test` and `npm run build` for code changes. If a command cannot run,
report the exact blocker rather than implying it passed.
