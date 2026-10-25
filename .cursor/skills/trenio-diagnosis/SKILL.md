---
name: trenio-diagnosis
description: >-
  Diagnoses Trenio.by failures from app_logs and the database. Use when the user
  reports a bug, an exception, a failed login, mail, form, map, or message, or
  runs /diagnosis.
---

# Diagnosis

Read `.cursor/skills/trenio-logging/SKILL.md` and [reference.md](../trenio-logging/reference.md) first. The journal is the source. Do not guess a stack that is not in the row.

## Steps

1. Install if needed: `npm run logs:install`.
2. Run `npm run logs:diagnose` with the narrowest flag that fits:
   - person: `--email user@example.com` or `--user <uuid>`
   - one request: `--request <uuid>`
   - area: `--domain auth|email|sms|account|form|map|geo|message|ajax|client|system|admin|catalog`
   - text: `--q "фрагмент"`
   - window: `--hours 24` (default) and `--level error`
3. Read `groups` first, then the newest `rows`. Open the file from the reference map for that `action`.
4. Correlate `request_id` with a client `ajax.*` or `client.*` row when the browser failed and the server also failed.
5. Reply in Russian. Use this shape:

```markdown
## Что сломано
One sentence: domain, action, how often, since when.

## Доказательство
- time, level, outcome, message, error_code
- subject / target / route / request_id
- the stack line that names a file, when the row has one

## Где в коде
File and function.

## Что сделать
1. The change that removes this failure.
2. The check: `npm run logs:diagnose -- --action <action> --hours 1` after the fix.
```

## Do not

- Print passwords, OTP, reset links, or message HTML. The journal must not contain them; if a row does, say so and point at `redact.ts`.
- Treat a missing table as an application bug. Run `logs:install`.
- Treat `message.list` silence as health. Polls are stored only when they fail.
- Recommend `db:push` to create `app_logs`.
