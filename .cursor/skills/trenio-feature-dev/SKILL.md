---
name: trenio-feature-dev
description: >-
  Implements Trenio.by features following TanStack Start conventions, the shared
  layout grid, PostgreSQL auth, PWA compatibility, and mobile-first UI. Use when
  adding routes, pages, catalog features, auth flows, or backend integration in
  the trenio project.
---

# Trenio Feature Development

## Before coding

1. Read `docs/TECH_SPEC.md` and relevant product/account docs
2. Confirm scope: route-only UI vs server fn + DB
3. Plan mobile layout first (320px), then desktop

## Route workflow

1. Create `src/routes/<name>.tsx` with `createFileRoute`
2. Add `head()` meta (title, description)
3. Use server functions for data — not raw DB in loaders on client
4. Update `docs/README.md` routes table

## UI workflow

The layout grid is the primary layout rule. Read `.cursor/rules/layout-grid.mdc` before placing anything on a page.

- Put page content in `.layout-container` (or the same `max-width` + `padding-inline` pair). Header, hero, and footer share those edges.
- Horizontal icon or card rails use `.layout-rail`. Do not give them `width: 100vw` or zero side padding.
- Card lists use `.card-grid` / `.trainer-grid` / `.cat-grid` and the other shared grid classes. Do not set `grid-template-columns` on them in route CSS.
- Icons: `SportIcon` for sports, existing pin/chevron/heart/star paths for chrome. Stroke is `var(--icon-stroke)`. See `.cursor/rules/icons.mdc`.
- Breadcrumbs: the current page has `is-current` and `aria-current="page"`. Color stays `var(--primary)` from `src/styles.css`. See `.cursor/rules/breadcrumbs.mdc`.
- Filter + results pages use `.layout-with-sidebar`.
- Reuse `site-chrome.tsx`, shadcn `src/components/ui/`
- Auth pages: `AuthStyles` + `useAuthSubmit` pattern. The form can be narrow; the page chrome stays on `--layout-max`.
- Breakpoint 768px for touch; card columns collapse at 960px and 640px. Touch targets ≥44px.

## PWA & mobile gates

Before marking done, run mental checklist from:

- `.cursor/skills/trenio-pwa-audit/SKILL.md`
- `.cursor/skills/trenio-mobile-audit/SKILL.md`

## After implementation

Run `.cursor/skills/trenio-docs-sync/SKILL.md` if routes, auth, or architecture changed.

## Anti-patterns

- `src/pages/` or Next.js patterns
- Importing `src/db/` from client components
- Auth only in `beforeLoad` without server fn middleware
- Desktop-only hover menus without mobile fallback
- A content width other than `--layout-max`, `--layout-staff-max` (admin and superadmin cabinet only), or `--layout-prose-max`; a double gutter; or `repeat(auto-fill, minmax(...))` for catalog cards
- A filled sport pictogram next to a line icon, or a one-off stroke width
