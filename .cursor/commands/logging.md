# Journal check

Check that Trenio.by writes actions and failures into `app_logs`, and that the logger redacts secrets.

## Do this now

1. Read `.cursor/skills/trenio-logging/SKILL.md` and `.cursor/rules/logging.mdc`.
2. Run `npm run logs:install`, then `npm run logs:check`.
3. If the gap scan lists a file, open it and route that `console.error` / `console.warn` through `writeLog` or `logCaught`. Leave seed, Instagram sync, and `*.sync-conflict*` files alone.
4. If the probe fails, fix `src/lib/log/redact.ts` or the insert path. The probe must keep `email` and store `password` as `[redacted]`.
5. Say whether the table exists, whether the probe round-trip passed, and which files still log only to the terminal.
