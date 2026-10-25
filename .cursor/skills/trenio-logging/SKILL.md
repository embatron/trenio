---
name: trenio-logging
description: >-
  Writes and reviews the Trenio.by operational journal (app_logs): auth, email,
  SMS, accounts, forms, maps, geo, API, system, messages, and browser AJAX
  errors, with redaction and 30-day retention. Use when adding server functions,
  catch blocks, mail, login, forms, the map, messages, error handling, or when
  the user mentions logging, logs, exceptions, or /logging.
---

# Journal

The table is `app_logs`. Rows expire after 30 days. The writer is `writeLog` / `logCaught` in `src/lib/log/logger.ts`. Full action list: [reference.md](reference.md).

## Add a log

1. Pick a domain from `LOG_DOMAINS` in `src/lib/log/policy.ts`.
2. Use one dotted action (`auth.login`, `form.review`, `map.area`). The same action covers success and failure; `outcome` tells them apart.
3. Call `writeLog` for an expected result and `logCaught(domain, action, error)` for a thrown or swallowed error.
4. Pass `subject` (email, or `maskPhone`), `actorUserId`, and `target` (slug or conversation id). Put only safe fields in `context`.
5. Do not log the success of a 5-second poll.

A new `console.error` or `console.warn` in `src/` must sit in a file that imports `@/lib/log/`. `npm run logs:check` fails when that import is missing. Seed, Instagram sync, and `*.sync-conflict*` files are excluded.

## Commands

| Script | Purpose |
| --- | --- |
| `npm run logs:install` | `CREATE TABLE IF NOT EXISTS app_logs`. Not `db:push`. |
| `npm run logs:check` | Gap scan, then a probe row that must redact `password` and keep `email`. |
| `npm run logs:diagnose` | Grouped rows. Flags: `--hours --domain --level --email --user --action --target --request --q`. |
| `npm run logs:purge` | Delete rows whose `expires_at` has passed. |

## Client

`installClientLogReporter` in the root listens for `error`, `unhandledrejection`, and same-origin `fetch` failures (status ≥ 500 or a network error). It posts `reportClientLogsFn`. The server drops any message that contains `password`, `token=`, `bearer`, or `otp`. Guests are allowed; the actor is set only from the session.

## Cabinet

`/admin/accounts/$id` and `/admin/trainers/$slug` merge these rows into the «Логи» tab (`listActorJournal`). The tab does not show `stack` or `context`. `/diagnosis` does.

## After a schema or domain change

Update `docs/TECH_SPEC.md` §4.8 and this skill's [reference.md](reference.md). Do not add a foreign key from `actor_user_id` to `users`.
