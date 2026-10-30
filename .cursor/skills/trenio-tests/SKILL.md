---
name: trenio-tests
description: >-
  Runs Trenio.by unit tests and Playwright page checks, including anti-pattern
  cases, then writes recommendations. Use when the user asks for tests, coverage,
  Playwright, anti-patterns, or runs /tests.
---

# Tests

Unit tests use `node:test` via `npm test`. Browser checks use Playwright via `npm run test:e2e`. The app under test is `PLAYWRIGHT_BASE_URL` or `http://127.0.0.1:8080`. Playwright reuses a server that is already running.

## Run

1. `npm test` — journal redaction and retention, auth error text, Belarus phone storage, geo normalize, message access, message attachments.
2. `npm run test:e2e` — home, categories, login, 404, map, `/join/trainer`, plus the anti-patterns in `e2e/`.
3. If Playwright browsers are missing, run `npx playwright install chromium` once and repeat the e2e command.

## Anti-patterns the suite asserts

- Login copy never echoes the password.
- The honeypot `company_website` is not a visible field.
- An unknown URL shows «Мяч ушёл за линию».
- Home, login, and the map do not scroll sideways at 390px.
- Home and login do not raise `pageerror`.
- `/join/trainer` with an empty Instagram stays on the form. A filled honeypot still shows «Спасибо», and `form.welcome` is `denied` with `reason: honeypot`. The trap string and the typed handle are absent from that row.
- A real Instagram submit writes `form.welcome` `success`. `target` is the handle. `context` is only `{ channel: "instagram" }`. The spec then deletes that `trainer_welcomes` row.
- «У меня нет Instagram» with an empty Telegram and phone stays on the form. A Telegram name writes `form.welcome` `success`, `target` is that name, `route` is `/join/trainer`, and `context` is only `{ channel: "other" }`. The phone prefix is absent. The spec deletes that row by Telegram.
- The same branch with only `+375 29 123-45-67` writes `subject` `375*******67`, an empty `target`, and does not put the formatted number in the journal. `trainer_welcomes.phone` stores `+375 29 123-45-67`. The spec deletes that row by phone.
- `+375 17 123-45-67` stays on the form. A landline is not a stored mobile. `src/lib/auth/phone.test.ts` checks that every spelling of one mobile becomes that same stored string.

## Recommendations

After the commands finish, answer in Russian. Do not stop at pass/fail. Use:

```markdown
## Результат
- unit: pass or the failing test name
- e2e: pass or the failing spec

## Что поменять
1. Must fix — the failure, the file, the change.
2. Should change — a flake, a missing case, or a product anti-pattern the test only narrowed.
3. Watch — something that passed but is brittle.

## Какой тест добавить
One concrete case that the run showed was not covered.
```

A red test is a recommendation with a file, not a request to weaken the assertion. Fix the product when the assertion matches `.cursor/rules/`. Ask before changing a test that is already correct.

## Controlled inputs

Wait until the login field has a React fiber before typing. A `fill` or `pressSequentially` that lands before hydration is wiped, and the server receives an empty string. Empty-string Zod text is covered by `src/lib/auth/errors.test.ts`: the alert must be the first issue message, never the raw JSON.

## When adding a page

Add a Playwright case for the empty state and one bad input. Add a `node:test` for a pure rule (limit, redaction, access). Do not point a test at `db:push`.
