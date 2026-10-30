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

**Trenio.by** — PWA-ready, mobile-first sports catalog for Belarus (TanStack Start + PostgreSQL). The product UI and `docs/` stay Russian. Agent rules, skills, commands, and this file stay English.

## Read first

| Priority | Document |
| --- | --- |
| 1 | [docs/TECH_SPEC.md](docs/TECH_SPEC.md) — architecture, auth, PWA, mobile-first |
| 2 | [docs/PRODUCT.md](docs/PRODUCT.md) — product & catalog |
| 3 | [docs/ACCOUNT_MODEL.md](docs/ACCOUNT_MODEL.md) — domain entities |
| 4 | [docs/README.md](docs/README.md) — routes & commands |

## Non-negotiable constraints

1. **Layout grid** — every screen shares one content grid (header, hero, cards, footer). See `.cursor/rules/layout-grid.mdc` and `TECH_SPEC.md` §7.4.
2. **Icons** — one line-icon style (`--icon-stroke`). Sport marks come from `SportIcon`. See `.cursor/rules/icons.mdc`.
3. **PWA 100%** — every UI/feature change must stay installable-app compatible (manifest, SW, offline). See `TECH_SPEC.md` §6.
4. **Mobile-first** — design for `<768px` first; touch targets ≥44px. See `TECH_SPEC.md` §7.
5. **Routes** — only `src/routes/`, never `src/pages/`.
6. **Auth boundary** — private data in `createServerFn` + middleware, not route guards alone.
7. **No `src/server/auth/`** — canonical auth path is `src/auth/`; server fns in `src/lib/auth/functions.ts`.
8. **Docs sync** — after structural changes, update relevant `docs/` files (see TECH_SPEC §12). Product docs stay Russian; this file and `.cursor/` stay English (`.cursor/rules/process-language.mdc`).
9. **Visitor city** — resolve the city with local GeoLite2 (`ip-location-api`). Do not call a hosted geo API. The `trenio_place` cookie stores the city name, not the IP. Catalog search shows that city, or `Минск` when none is known. See `.cursor/rules/visitor-place.mdc`.
10. **Breadcrumbs** — the current page crumb uses `is-current` and `aria-current="page"`. Its color is `var(--primary)`. See `.cursor/rules/breadcrumbs.mdc`.

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
| `.cursor/skills/trenio-mobile-audit/` | UI/layout/responsive changes. Command: `/mobile-adapt` |
| `.cursor/skills/trenio-docs-sync/` | After tasks — sync documentation |
| `.cursor/skills/trenio-instagram-trainers/` | Import public Instagram trainer profiles into drafts, including pinned photos and readable card text. Command: `/import-instagram-trainers` |
| `.cursor/skills/trenio-messages/` | Direct messages: who can write, composer, receipts, polling. Rule: `.cursor/rules/messages.mdc` |
| `.cursor/skills/trenio-logging/` | Operational journal in `app_logs` (30 days). Command: `/logging`. Rule: `.cursor/rules/logging.mdc` |
| `.cursor/skills/trenio-diagnosis/` | Diagnose a failure from `app_logs`. Command: `/diagnosis` |
| `.cursor/skills/trenio-tests/` | Unit tests plus Playwright, then recommendations. Command: `/tests` |
| `.cursor/skills/trenio-seo/` | Public-page SEO for Belarus: titles, canonical, robots, sitemap, schema.org. Subagent: `seo` |

## Hooks

Automatic hooks are **off**. At the end of a task, run the **`/hooks`** slash command (`.cursor/commands/hooks.md`) — layout grid, icons, PWA audit, mobile audit, docs sync. For a full phone and tablet pass over the latest UI, run **`/mobile-adapt`** (`.cursor/commands/mobile-adapt.md`).
