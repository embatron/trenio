---
name: trenio-mobile-audit
description: >-
  Audits Trenio.by UI for mobile-first compliance — breakpoints, touch targets,
  responsive layout, mobile navigation. Use when editing components, routes,
  styles, or auth pages in trenio.
---

# Trenio Mobile-First Audit

Mobile-first is mandatory. Primary viewport: **320–767px**.

## Reference

- Breakpoint: **768px** (`src/hooks/use-mobile.tsx`)
- Auth responsive: `src/components/auth-styles.tsx` (@media max-width 600px)
- Site chrome: `src/components/site-chrome.tsx`

## Audit checklist

### Layout

- [ ] No horizontal overflow on 320px (except intentional carousels)
- [ ] Single-column primary flow on mobile
- [ ] Spacing not excessive on small screens (compact sections)

### Touch & interaction

- [ ] Tap targets ≥44×44px
- [ ] `cursor: pointer` on clickable elements
- [ ] No hover-only critical actions (provide tap alternative)
- [ ] Modals/sheets usable on mobile (shadcn Sheet/Drawer)

### Navigation

- [ ] Header accessible on mobile (burger/menu if needed)
- [ ] Mega menu has mobile accordion or alternative
- [ ] Sticky elements don't hide primary content

### Forms

- [ ] Inputs full-width on mobile
- [ ] Labels visible; font-size ≥14px
- [ ] Password toggle reachable by thumb

### Tailwind

- [ ] Mobile-first classes: base = mobile, `md:` = desktop enhancement
- [ ] Avoid fixed widths that break on small screens

## Test mentally at widths

320px · 375px · 768px · 1280px

## Output format

```markdown
## Mobile Audit
- Status: PASS | NEEDS WORK
- Issues: …
- Fixes applied: …
```
