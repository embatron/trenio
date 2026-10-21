# Trenio.by Cursor hooks

Automatic hooks are **off**. Checks run by hand through the **`/hooks`** slash command.

## Manual checklist

| Command | File | When |
| --- | --- | --- |
| `/hooks` | `.cursor/commands/hooks.md` | End of a task that needs layout, icons, PWA, mobile, and docs sync |

In Cursor chat, type `/` and choose **hooks**.

## Scripts (legacy, not wired)

Scripts in `.cursor/hooks/` are kept as reference. `.cursor/hooks.json` has an empty hooks list:

| Script | Former role |
| --- | --- |
| `session-start.mjs` | Inject constraints at session start |
| `post-ui-edit.mjs` | Reminder after UI edits |
| `stop-checklist.mjs` | Follow-up checklist on agent stop |

To turn automation back on, add the entries you need to `hooks.json` (see [Cursor hooks docs](https://cursor.com/docs/agent/hooks)).

## Debugging

1. Cursor → Settings → Hooks — confirm `hooks.json` is loaded.
2. Hooks output channel — script logs, when hooks are enabled.
3. After editing `hooks.json`, restart Cursor if the new entries do not appear.
