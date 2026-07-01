---
name: trenio-pwa-audit
description: >-
  Audits Trenio.by changes for 100% PWA compatibility — manifest, service worker,
  offline, installability, caching. Use when implementing UI, routes, assets,
  auth, or before finishing any frontend task in trenio.
---

# Trenio PWA Audit

Trenio.by must remain **100% PWA-compatible**. Run this audit when touching frontend, routing, or static assets.

## Audit checklist

### Installability

- [ ] `manifest.webmanifest` present or planned (name, icons, theme_color, display)
- [ ] Icons 192×192 and 512×512 in `public/icons/`
- [ ] `theme-color` meta in root or route head
- [ ] HTTPS in production

### Service worker

- [ ] SW registered without blocking first paint
- [ ] Cache strategy documented (precache shell, network-first for API)
- [ ] SW update does not trap users on stale auth state
- [ ] `/offline` fallback route exists or is planned

### Runtime behavior

- [ ] App usable after «Add to Home Screen»
- [ ] No reliance on `window.open` popups for core flows
- [ ] Auth session cookies work in standalone mode (SameSite=Lax, correct Path)
- [ ] SSR hydration clean in standalone — no white screen

### Assets

- [ ] New static files in `public/` with cache-friendly names
- [ ] SVG/PNG icons maskable where possible

## Current project status

See `docs/TECH_SPEC.md` §6 — manifest/SW/offline are **Planned**. New work must not block future PWA integration.

## If gaps found

1. Fix in code, or
2. Update `docs/TECH_SPEC.md` §6 with concrete next steps and mark blockers

## Output format

```markdown
## PWA Audit
- Status: PASS | NEEDS WORK
- Blockers: …
- Actions taken: …
```
