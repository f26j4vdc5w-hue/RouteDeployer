---
name: supabase-migration
description: Add or change Supabase schema behavior safely in RouteDeployer, including forward-only SQL migrations, RLS, TypeScript callers, and validation.
---

# Supabase migration workflow

Use this workflow when a feature requires a database schema, policy, trigger, or
RPC change.

1. Read the affected table/function, related migrations, TypeScript data access,
   and the migration-specific instructions before editing.
2. Add a new uniquely numbered migration; never edit an existing migration.
   Migrations merged to `main` are automatically applied to the connected
   Supabase project.
3. Design grants, RLS policies, and function permissions together. Enforce
   authorization in the database, follow the repository's `SECURITY DEFINER`
   pattern, and return no private data beyond the caller's authorization.
4. Update the TypeScript caller and focused tests or docs that depend on the
   changed schema. Do not run `npm run seed:supabase`; it can overwrite managed
   tour data.
5. Run `npm test` and `npm run build`. If a local database is unavailable,
   state that SQL behavior was not executed against Supabase rather than
   claiming full database validation.
