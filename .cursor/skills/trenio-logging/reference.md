# Journal reference

## Domains

`auth` `email` `sms` `account` `form` `map` `geo` `api` `system` `message` `ajax` `client` `admin` `catalog`

## Actions

| Action | When |
| --- | --- |
| `auth.login` | Email or nick login, including honeypot denial |
| `auth.sms.request` / `auth.sms.confirm` | SMS login |
| `auth.telegram` / `auth.telegram.webapp` | Telegram login |
| `auth.signup` / `auth.logout` | Registration and logout |
| `auth.password.forgot` / `auth.password.reset` | Email reset. The token is not stored |
| `auth.password.forgot_sms` / `auth.password.reset_sms` | SMS reset |
| `auth.email.verify` | Email confirmation |
| `account.email.request` / `account.email.confirm` | Account email change |
| `account.phone.request` / `account.phone.confirm` | Account phone |
| `account.password.change` / `account.avatar` / `account.name` | Cabinet settings |
| `account.claim` | Trainer claim |
| `email.send` / `email.dev` / `email.review` | Resend, dev console, review mail |
| `sms.send` / `sms.dev` | SMS.BY, or the dev console without the code |
| `form.welcome` / `form.review` / `form.trainer_admin` / `form.trainer_profile` | Public and cabinet forms. `form.welcome` awaits the insert. `target` is the Instagram or Telegram handle. A phone is `subject` as a mask, and a phone-only welcome leaves `target` empty. The welcome row stores `+375 29 123-45-67`, not the raw field. A honeypot is `denied` with `reason: honeypot` and no handle. |
| `map.area` | `listMapAreaFn` |
| `geo.cache.read` / `geo.cache.write` / `geo.profile` / `geo.visitor` | Geocoder and visitor place |
| `message.send` / `message.ensure` / `message.close` / `message.reopen` / `message.report` / `message.dismiss` / `message.block` / `message.notify` | Message mutations and notices |
| `message.list` / `message.thread` / `message.read` / `message.unread` / `message.hide` | Failures only |
| `admin.review` | Review publish or reject |
| `catalog.claim` | Welcome-link side effect failed |
| `system.ready` / `system.unhandled` / `system.ssr` / `system.purge` / `system.probe` | Process and unhandled errors |
| `ajax.http` / `ajax.network` | Browser fetch failure |
| `client.error` / `client.rejection` / `client.boundary` | Browser exception |

## Where to look

| Symptom | Open |
| --- | --- |
| Login, signup, password, email code | `src/lib/auth/functions.ts`, `src/auth/service.ts` |
| SMS | `src/auth/sms.ts`, `src/auth/otp.ts` |
| Mail body leaked or mail failed | `src/lib/mail/send.server.ts` |
| Message send or notify | `src/lib/messages/functions.ts`, `src/lib/messages/notify.ts` |
| Map frame | `src/lib/catalog/map-trainers.ts` |
| Address or visitor city | `src/lib/geo/resolve.ts`, `src/lib/catalog/visitor-place.ts` |
| Blank 500 page | `src/start.ts`, `src/server.ts` |
| Browser error with no server row | `src/lib/log/client-reporter.ts` |
| Staff «Логи» tab | `src/lib/log/journal.ts` |

## Redaction

`redactContext` replaces values whose keys match password, token, secret, otp, cookie, session, body, text, html, or `code`. `safeRoute` drops the query string. Stacks are truncated to 4000 characters and bearer tokens are stripped. `LOG_RETENTION_DAYS` is 30.
