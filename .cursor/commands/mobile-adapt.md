# Mobile adapt

Recheck the latest UI for a phone-first layout and an installable PWA. Run this after header, catalog, auth, or template work, or when the user asks for a mobile pass.

## Project context

- **Phone** is under **768px**. Tablet starts at 768px. Desktop enhancement starts at 1024px. The hook is `src/hooks/use-mobile.tsx`.
- **Layout grid** — one content width and one gutter (`.cursor/rules/layout-grid.mdc`).
- **Icons** — line icons at `--icon-stroke` (`.cursor/rules/icons.mdc`).
- **PWA** — manifest, `theme-color`, `viewport-fit=cover`, standalone display (`docs/TECH_SPEC.md` §6). Service worker and `/offline` stay planned. Do not cache signed-in HTML.
- **Header search** — hidden below 768px. From 768px to 999px it sits on its own row under the logo. From 1000px it sits beside the logo and appears only after scroll. Logo stays left; help, favorites, account, and the menu stay on the right, at rest and after scroll.
- **Touch** — primary controls are at least 44×44px.
- **Language** — this command stays English. Product UI stays Russian.

## Gather the scope

Build the list before opening the browser. Use all of these:

1. Components, routes, and CSS named in the current chat.
2. Uncommitted files under `src/routes/`, `src/components/`, `src/styles.css`, and `public/`.
3. Every route that renders a component from that list. Shared chrome counts even when the chat did not name it: `SiteHeader`, `SiteFooter`, `CatalogSearchForm`, the mega menu.

Always include `/`, one parent category, one child category, `/categories/`, `/clubs`, one trainer profile, `/search`, `/auth/login`, and `/privacy` when those routes exist.

## Do this now

1. Read `.cursor/skills/trenio-mobile-audit/SKILL.md` and `.cursor/skills/trenio-pwa-audit/SKILL.md`. Follow both checklists.
2. Open the running app in Playwright, or the available browser. Viewports: **320, 390, 768, 1024**.
3. For every scoped route at every viewport, load the page and scroll it. Check the real boxes, not a single screenshot:
   - No horizontal overflow, except an intentional rail inside `.layout-rail`.
   - Header logo and the icon group share one row. The menu button’s right edge matches the content gutter.
   - Below 768px the header search is `display: none` and does not reserve a row.
   - At 768px and 1024px the header search is in the header after scroll, does not cover the logo or the icons, and its labels are not clipped.
   - Page title, cards, and footer brand share the header’s left edge.
   - Catalog cards use the shared grid classes and collapse to one column by 640px.
   - Primary controls (header icons, favorite on a card, submit, filter chips that are the only way to choose) are at least 44×44px.
   - Inputs are full width on a phone. Text in them is at least 14px.
   - Nothing needed to finish a task exists only on hover.
4. PWA, once per run: `link[rel=manifest]`, `theme-color` `#f04b50`, viewport contains `viewport-fit=cover`, icons 192 and 512, `display: standalone`. Standalone must not depend on `window.open`.
5. Fix every failure in this run. Then load the failing route at the failing width again.
6. Treat phone and tablet as different layouts. A fix for 390px must still hold at 768px and 1024px.

## Result

```markdown
## Mobile Audit
- Status: PASS | NEEDS WORK
- Viewports: 320, 390, 768, 1024
- Routes: …
- Issues: …
- Fixes applied: …

## PWA Audit
- Status: PASS | NEEDS WORK
- Blockers: …
- Actions taken: …
```
