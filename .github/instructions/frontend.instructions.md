---
applyTo: "src/**/*.tsx"
---

# Frontend conventions

- Keep visible text in German and follow the existing component and CSS
  conventions in the feature directory.
- Preserve keyboard operation, semantic markup, focus handling, and accessible
  names when changing interactive controls.
- Keep authorization and privacy enforcement in Supabase; hiding a control in
  the UI is not a security boundary.
- Surface loading and error states explicitly. Do not silently replace backend
  failures with empty or success-shaped data.
- Add or update focused tests for behavior changes, then run `npm test` and
  `npm run build`.
