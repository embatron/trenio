# Trenio.by Cursor Hooks

Hooks автоматизируют проверки PWA, mobile-first и синхронизацию документации.

## Конфигурация

Файл: `.cursor/hooks.json`

| Hook | Скрипт | Когда |
| --- | --- | --- |
| `sessionStart` | `session-start.mjs` | Старт сессии — inject PWA/mobile/docs constraints |
| `postToolUse` | `post-ui-edit.mjs` | После Write/StrReplace UI файлов (`src/routes`, `src/components`, `styles.css`) |
| `stop` | `stop-checklist.mjs` | Завершение задачи агента — follow-up checklist (max 1 loop) |

## Что проверяется

### PWA 100%

Проект обязан оставаться совместимым с installable PWA. Напоминания при каждой правке UI и в финальном checklist.

### Mobile-first

Breakpoint 768px, touch targets, responsive layout — напоминание после правок `.tsx`/`.css`.

### Docs sync

При `stop` агент получает follow-up: проверить и обновить `docs/` если менялись routes, auth, schema, env.

## Отладка

1. Cursor → Settings → Hooks — убедиться что hooks загружены
2. Hooks output channel — логи скриптов
3. После правки `hooks.json` — перезапуск Cursor при необходимости

## Зависимости

- Node.js (>= 22 рекомендуется, как у проекта)
- Скрипты executable: `chmod +x .cursor/hooks/*.mjs`
