---
name: trenio-feature-dev
description: >-
  Implements Trenio.by features following TanStack Start conventions, PostgreSQL
  auth, PWA compatibility, and mobile-first UI. Use when adding routes, pages,
  catalog features, auth flows, or backend integration in the trenio project.
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

- Reuse `site-chrome.tsx`, shadcn `src/components/ui/`
- Auth pages: `AuthStyles` + `useAuthSubmit` pattern
- Breakpoint 768px; touch targets ≥44px

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
