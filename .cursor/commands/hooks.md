# Trenio.by — closing checklist (manual)

Run this command at the end of a task when layout, PWA, mobile-first, or documentation checks are required. Automatic Cursor hooks are off. This checklist runs only when asked.

## Project context

- **Layout grid** — every screen uses one content grid (`.cursor/rules/layout-grid.mdc`, `docs/TECH_SPEC.md` §7.4).
- **Icons** — line icons at `--icon-stroke` (`.cursor/rules/icons.mdc`).
- **PWA 100%** — the change stays compatible with an installable app (`docs/TECH_SPEC.md` §6).
- **Mobile-first** — design from `<768px`; touch targets are at least 44px (`docs/TECH_SPEC.md` §7).
- **Stack**: TanStack Start, routes in `src/routes/`, auth through `createServerFn`.
- **Docs sync** — after structural changes, update `docs/` (`docs/TECH_SPEC.md` §12).
- **Language** — process files in English; product UI and `docs/` in Russian (`.cursor/rules/process-language.mdc`).

## Do this now

1. **Layout grid** — changed screens use `.layout-container` / `.layout-with-sidebar` and the shared card-grid classes from `src/styles.css`. Rule: `.cursor/rules/layout-grid.mdc`. The current breadcrumb uses `is-current`, `aria-current="page"`, and `var(--primary)`. Rule: `.cursor/rules/breadcrumbs.mdc`.
2. **Icons** — new icons match `.cursor/rules/icons.mdc` (24px line icons, one glyph per idea, sport marks from `SportIcon`).
3. **PWA audit** — read and apply `.cursor/skills/trenio-pwa-audit/SKILL.md`: manifest, service worker, offline, standalone mode, `public/` assets.
4. **Mobile audit** — read and apply `.cursor/skills/trenio-mobile-audit/SKILL.md`: 320px layout, touch targets, responsive nav and forms, no hover-only actions.
5. **Docs sync** — read and apply `.cursor/skills/trenio-docs-sync/SKILL.md`. Update docs when routes, auth, DB schema, env, or architecture changed.

Documents to check:

- `docs/README.md`
- `docs/TECH_SPEC.md`
- `docs/PRODUCT.md`
- `docs/ACCOUNT_MODEL.md`

## Result

- If the change complies and the docs are current, say the checklist passed.
- If something fails, fix the code and the docs in this pass.
