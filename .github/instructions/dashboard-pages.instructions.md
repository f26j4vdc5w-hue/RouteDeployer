---
applyTo: "src/features/**/*.{tsx,css}"
---

# Dashboard-Seiten

Use this convention for the Getränke-, Profil-, Admin- and future dashboard-style
pages. It intentionally reuses the established dashboard shell instead of
introducing a new page-specific visual language.

## Layout

- Wrap the page in `<main className="admin-shell">`.
- Put content in `<div className="admin-dashboard">`.
- Use `admin-header` as the direct child of `admin-dashboard`.
- Keep the header sticky at the top of the viewport. The shared
  `admin-dashboard > .admin-header` rule supplies the sticky background and
  viewport-wide top surface.
- Place a kicker and H1 in the header:
  - Community pages: `KLLKTV Community`
  - Admin pages: `KLLKTV Roadbook`
- The main title uses `h1` and `clamp(24px, 5vw, 34px)` from the existing
  dashboard styles.
- Place actions on the right, with `CommunityAccount` as the shared
  hamburger/navigation control.
- Use at least 20px gap between dashboard sections and 22px card padding.
- Keep the dashboard width at `1120px` on desktop; on small screens use 12px
  side padding and 16px card padding.
- On mobile, keep the title and hamburger in the same header row. The header
  remains sticky and the hamburger stays at the top right.

## Cards and grouping

- Use `<section className="admin-card">` for every grouped content area.
- Use card headings as `h2`, with the card body and controls following directly
  below.
- Do not nest an outer page panel around dashboard cards.
- Separate logically distinct groups into separate cards: account/profile,
  settings or data entry, detailed lists, passkeys, status, or actions.
- Keep card controls and text in the dashboard column rather than creating
  another card-inside-card layout.

## Typography and colors

- Use only existing tokens:
  `--bg`, `--surface`, `--surface-muted`, `--ink`, `--muted`, `--border`,
  `--accent`, `--accent-strong`, `--tint`, `--on-accent`.
- Cards use `--surface`, not `--surface-muted`.
- Cards use `1px solid var(--border)`, `var(--radius-md)`, and 22px padding.
- Use `--muted` for secondary text and the kicker.
- Keep headings in `--ink`; use `--accent-strong` only for links, active states,
  and focused actions.
- Do not introduce page-specific font families, sizes for ordinary body text,
  gradients, or drop-shadow card styles.
- German user-facing copy is required.

## Forms and states

- Reuse `.community__form`, `.community__section`, `.admin-form`,
  `.admin-button`, and the existing input styles before adding component CSS.
- Labels use existing muted text and form spacing.
- Inputs use `--bg`, `--border`, `var(--radius-sm)`, 42px minimum height, and
  `font: inherit`.
- Show loading, success, error, empty, and permission states explicitly.
- Loading and status text use existing role attributes: `role="status"` or
  `role="alert"`.
- Preserve keyboard navigation, visible focus states, semantic headings, labels,
  `aria-current`, and accessible names.

## Navigation

- Use `CommunityAccount` instead of standalone profile or logout buttons for
  dashboard headers.
- The shared hamburger menu contains Roadbook, Getränke, Profile, Adminbereich
  where permitted, and Abmelden for authenticated users.
- Mark the current page with `aria-current="page"` and the active menu style.
- Never hide security or authorization checks in the UI alone.
