---
name: trenio-docs-sync
description: >-
  Syncs Trenio.by documentation after code changes — updates docs/README,
  TECH_SPEC, PRODUCT, ACCOUNT_MODEL when routes, auth, schema, or architecture
  change. Use at end of feature tasks or when hooks request doc review.
---

# Trenio Documentation Sync

Keep `docs/` aligned with code. Read `docs/TECH_SPEC.md` §12 for the full map.

## Workflow

1. **Identify changes** — routes, auth, DB, env, PWA assets, product behavior
2. **Open affected docs** — do not duplicate; cross-link
3. **Update tables** — especially `docs/README.md` implemented routes
4. **Update checklists** — `TECH_SPEC.md` §6 PWA status when implementing PWA pieces
5. **Verify links** — README → PRODUCT, ACCOUNT_MODEL, TECH_SPEC

## Sync matrix

| Code change | Doc files |
| --- | --- |
| `src/routes/*.tsx` add/remove | `docs/README.md` |
| `src/db/schema/*` | `docs/TECH_SPEC.md` §4, maybe `ACCOUNT_MODEL.md` |
| `src/lib/auth/*`, `src/auth/*` | `docs/TECH_SPEC.md` §4, `ACCOUNT_MODEL.md` |
| `.env.example` | `docs/TECH_SPEC.md` §8 |
| Product/SEO/taxonomy | `docs/PRODUCT.md` |
| PWA/manifest/SW | `docs/TECH_SPEC.md` §6 |
| `.cursor/rules`, hooks | `docs/TECH_SPEC.md` §13, `AGENTS.md` |

## Do not edit unless changed

- `PROJECT_MATRIX.md` — does not exist (removed)
- BronxGym legacy docs — must not reintroduce

## Completion check

- [ ] All new routes listed in README
- [ ] TECH_SPEC reflects current stack/auth state
- [ ] No contradictory info between PRODUCT and TECH_SPEC
- [ ] AGENTS.md entry still accurate

## Output

List files updated and one-line summary per file.
