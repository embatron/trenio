# Journal reference

## Domains

`auth` `email` `sms` `account` `form` `map` `geo` `api` `system` `message` `ajax` `client` `admin` `catalog`

## Actions

| Action | When |
| --- | --- |
| `auth.login` | Email or nick login, including honeypot denial |
| `auth.sms.request` / `auth.sms.confirm` | SMS login |
| `auth.telegram` / `auth.telegram.webapp` | Telegram login |
| `auth.login.google` / `auth.signup.google` | Google sign-in. The code, token, and client secret are not stored |
| `auth.telegram.link` / `auth.telegram.unlink` | Bind or unbind Telegram on the signed-in account. No initData and no widget payload |
| `auth.signup` / `auth.logout` | Email registration and logout |
| `auth.signup.sms` | Phone registration: SMS request and confirm |
| `auth.signup.telegram` / `auth.signup.telegram.webapp` | Telegram registration |
| `auth.signup.credentials` | Mailbox and password saved after phone or Telegram signup. The password is not stored |
| `auth.password.forgot` / `auth.password.reset` | Email reset. The token is not stored |
| `auth.password.forgot_sms` / `auth.password.reset_sms` | SMS reset |
| `auth.email.verify` | Email confirmation |
| `account.email.request` / `account.email.confirm` | Account email change |
| `account.phone.request` / `account.phone.confirm` | Account phone. A signed Telegram contact uses `account.phone.confirm` and does not store the contact string, initData, or a widget payload. That path does not write Telegram |
| `trainer.email.confirm` / `trainer.telegram.confirm` | Overview confirms the login email (same address on the card) and Telegram. A Belarus mobile inside the signed Telegram payload can be stored with the confirm. The log has no phone digits. A phone-only share does not use this action |
| `account.password.change` / `account.avatar` / `account.name` / `account.mail` | Cabinet settings. `account.mail` stores the kind and whether it is on, not a letter |
| `account.delete` | The person deleted their own account. Data stays for six months. Subject, IP, and user-agent on that person's rows are kept, and those rows last until the hold ends. No message text |
| `account.restore` | The person confirmed restoration on the login page. A session starts |
| `account.purge` | The six-month hold ended. Written with the old email before the account is anonymized. No message text |
| `email.preference` | A message or review letter was not sent because that kind is off |
| `account.claim` | Trainer claim |
| `account.password` | Password chosen after the short Instagram link. The row has no password |
| `email.send` / `email.dev` / `email.review` | Postfix or Resend, dev console, review mail. The letter is HTML. Do not store the body, a code, or a link |
| `sms.send` / `sms.dev` | SMS.BY, or the dev console without the code |
| `form.welcome` / `form.review` / `form.trainer_admin` / `form.trainer_profile` / `form.trainer_contacts` / `form.nick_support` / `form.become_trainer` | Public and cabinet forms. `form.trainer_contacts` stores Instagram and Telegram on the trainer card. `form.welcome` awaits the insert. `target` is the Instagram or Telegram handle. A phone is `subject` as a mask, and a phone-only welcome leaves `target` empty. The welcome row stores `+375 29 123-45-67`, not the raw field. A honeypot is `denied` with `reason: honeypot` and no handle. `form.nick_support` is a nick-change request: the row stores the slug and the character count, not the request text. `form.become_trainer` is a plain account asking to become a trainer: the row stores the character count, not the request text. |
| `map.area` | `listMapAreaFn` |
| `map.locate` | Browser geolocation on `/map` and `/search`. Warn only. The visitor sees no note. The row has no coordinates. |
| `geo.cache.read` / `geo.cache.write` / `geo.profile` / `geo.suggest` / `geo.visitor` | Geocoder, address suggestions, and visitor place. `geo.suggest` and `geo.profile` log a failure when the map service does not answer. The row does not store the address text |
| `message.send` / `message.file` / `message.ensure` / `message.close` / `message.reopen` / `message.report` / `message.dismiss` / `message.block` / `message.notify` / `message.welcome` | Message mutations, attachment upload, and notices. `message.welcome` is the portal greeting to a new trainer. Log the size and extension, not the file name, the file body, or the welcome text. A download is logged only when it fails |
| `message.list` / `message.thread` / `message.read` / `message.unread` / `message.hide` | Failures only |
| `admin.review` | Review publish or reject |
| `admin.trainer_invite` | Staff copied the trainer message. The row stores the slug, not the links or the gap list. A published profile is `denied` |
| `admin.trainer_invite_sent` | The copied message was marked sent. The row stores the slug, not the text |
| `admin.trainer_note` | Staff saved a trainer note. The row stores the slug, not the note text |
| `admin.trainer_remove` | A trainer profile was removed from the portal. The row stores the slug |
| `catalog.trainer_preview` / `catalog.trainer_edit` / `catalog.trainer_save` / `catalog.trainer_publish` | Profile preview and edit links. They stay valid until the profile is published, then open the public trainer URL. A missing link is `denied`. Tokens and URLs stay out of the row |
| `catalog.claim` | Welcome-link side effect failed |
| `system.ready` / `system.unhandled` / `system.ssr` / `system.purge` / `system.probe` | Process and unhandled errors |
| `system.image` | TinyPNG failed while storing an upload. The original sharp file is kept. The API key is not stored |
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
