<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Trenio.by — Agent Entry Point

**Trenio.by** — PWA-ready, mobile-first спортивный каталог Беларуси (TanStack Start + PostgreSQL).

## Read first

| Priority | Document |
| --- | --- |
| 1 | [docs/TECH_SPEC.md](docs/TECH_SPEC.md) — architecture, auth, PWA, mobile-first |
| 2 | [docs/PRODUCT.md](docs/PRODUCT.md) — product & catalog |
| 3 | [docs/ACCOUNT_MODEL.md](docs/ACCOUNT_MODEL.md) — domain entities |
| 4 | [docs/README.md](docs/README.md) — routes & commands |

## Non-negotiable constraints

1. **PWA 100%** — every UI/feature change must stay installable-app compatible (manifest, SW, offline). See `TECH_SPEC.md` §6.
2. **Mobile-first** — design for `<768px` first; touch targets ≥44px. See `TECH_SPEC.md` §7.
3. **Routes** — only `src/routes/`, never `src/pages/`.
4. **Auth boundary** — private data in `createServerFn` + middleware, not route guards alone.
5. **No `src/server/auth/`** — canonical auth path is `src/auth/`; server fns in `src/lib/auth/functions.ts`.
6. **Docs sync** — after structural changes, update relevant `docs/` files (see TECH_SPEC §12).

## Stack quick reference

- Node **22+**, `npm run dev` (port 8080)
- TanStack Start + Router, React 19, Tailwind v4, shadcn/ui
- PostgreSQL via Drizzle (`npm run db:up`, `db:push`, `db:seed`)
- Roles: `user`, `trainer`, `club`, `admin`, `superadmin`

## Cursor skills (project)

| Skill | Use when |
| --- | --- |
| `.cursor/skills/trenio-feature-dev/` | New pages, routes, catalog features |
| `.cursor/skills/trenio-pwa-audit/` | PWA-related work or before finishing UI |
| `.cursor/skills/trenio-mobile-audit/` | UI/layout/responsive changes |
| `.cursor/skills/trenio-docs-sync/` | After tasks — sync documentation |

## Hooks

Project hooks in `.cursor/hooks.json` inject PWA/mobile reminders and trigger doc-sync audit on agent stop.
