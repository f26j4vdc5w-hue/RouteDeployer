---
applyTo: "supabase/migrations/**/*.sql"
---

# Supabase migration rules

- Add a new migration with a unique, increasing `YYYYMMDDNNNN_description.sql`
  filename. Never rewrite a migration that may already have been applied.
- Migrations are automatically applied to the connected Supabase project after
  merge to `main`; assume changes affect production data and permissions.
- Enable Row Level Security on tables exposed through Supabase APIs. Add only
  the grants and policies the feature needs; do not broaden anonymous access
  just to make a frontend request work.
- For `SECURITY DEFINER` functions, set `search_path = ''`, schema-qualify
  referenced objects, revoke execution from `public` (and `anon` when
  applicable), then grant it only to the intended role.
- Check authorization at the database boundary, including ownership, approved
  membership, and confirmed email where relevant. Client-side checks are not
  authorization.
- Preserve privacy for member profiles, attendance, contact details, and
  birthdays. Return only the fields and rows the caller is allowed to see.
- Update affected TypeScript callers and user-facing migration documentation.
  Do not run the seed script as part of migration work.
