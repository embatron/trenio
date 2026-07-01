# Trenio.by — closing checklist (manual)

Запускай эту команду **в конце задачи**, когда нужны проверки PWA, mobile-first и синхронизация документации. Автоматические Cursor hooks отключены — чеклист только по явному запросу.

## Контекст проекта

- **PWA 100%** — каждая правка должна оставаться совместимой с installable app (`docs/TECH_SPEC.md` §6).
- **Mobile-first** — дизайн с `<768px`, touch targets ≥44px (`docs/TECH_SPEC.md` §7).
- **Stack**: TanStack Start, маршруты в `src/routes/`, auth через `createServerFn`.
- **Docs sync** — после структурных изменений обновлять `docs/` (`docs/TECH_SPEC.md` §12).

## Выполни сейчас

1. **PWA audit** — прочитай и примени skill `.cursor/skills/trenio-pwa-audit/SKILL.md`: manifest/SW/offline impact, standalone mode, `public/` assets, no SW-breaking changes.
2. **Mobile audit** — прочитай и примени skill `.cursor/skills/trenio-mobile-audit/SKILL.md`: layout 320px, touch targets, responsive nav/forms, no hover-only actions.
3. **Docs sync** — прочитай и примени skill `.cursor/skills/trenio-docs-sync/SKILL.md`. Обнови документы, если менялись routes, auth, DB schema, env или architecture.

Документы для проверки:

- `docs/README.md`
- `docs/TECH_SPEC.md`
- `docs/PRODUCT.md`
- `docs/ACCOUNT_MODEL.md`

## Результат

- Если всё compliant и docs актуальны — кратко сообщи, что чеклист пройден.
- Если есть проблемы — исправь код и документы сейчас, не откладывай.
