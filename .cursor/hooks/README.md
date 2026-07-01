# Trenio.by Cursor Hooks

Автоматические hooks **отключены** — проверки запускаются вручную через slash-команду **`/hooks`**.

## Ручной чеклист

| Команда | Файл | Когда |
| --- | --- | --- |
| `/hooks` | `.cursor/commands/hooks.md` | В конце задачи, когда нужны PWA + mobile + docs sync |

В чате Cursor: набери `/`, выбери **hooks**.

## Скрипты (legacy, не подключены)

Скрипты в `.cursor/hooks/` сохранены как справочник; в `.cursor/hooks.json` hooks пустой:

| Скрипт | Было |
| --- | --- |
| `session-start.mjs` | Inject constraints at session start |
| `post-ui-edit.mjs` | Reminder after UI edits |
| `stop-checklist.mjs` | Follow-up checklist on agent stop |

Чтобы снова включить автоматику — добавь нужные entries в `hooks.json` (см. [Cursor hooks docs](https://cursor.com/docs/agent/hooks)).

## Отладка

1. Cursor → Settings → Hooks — убедиться что `hooks.json` загружен
2. Hooks output channel — логи скриптов (если hooks включены)
3. После правки `hooks.json` — перезапуск Cursor при необходимости
