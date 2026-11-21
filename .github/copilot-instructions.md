# Copilot instructions

Follow the repository-wide guidance in [`AGENTS.md`](../AGENTS.md). Use the
existing React/TypeScript patterns and keep the change limited to the requested
behavior.

- Keep all user-facing UI copy in German and preserve accessible keyboard and
  screen-reader behavior.
- Run `npm test` and `npm run build` when changing code.
- For database work, follow
  [the migration-specific instructions](instructions/supabase-migrations.instructions.md)
  and the `supabase-migration` skill.
- For a read-only review of Supabase access-control changes, use the
  `supabase-reviewer` agent.
- For dashboard-style pages, follow
  [the dashboard-page convention](instructions/dashboard-pages.instructions.md).
