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
| `auth.login.yandex` / `auth.signup.yandex` | Yandex sign-in. The code, token, client secret, and portrait bytes are not stored |
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
| `account.password.change` / `account.avatar` / `account.name` / `account.mail` / `account.push` | Cabinet settings. `account.mail` stores the kind and whether it is on, not a letter. `account.push` stores only whether phone notices are on |
| `account.delete` | The person deleted their own account. Account data stays for six months. The journal rows stay, including subject, IP, and user-agent. No message text |
| `account.restore` | The person confirmed restoration on the login page. A session starts |
| `account.purge` | The six-month hold ended. Written with the old email before the account is anonymized. No message text |
| `email.preference` | A message or review letter was not sent because that kind is off |
| `email.notice` | A service notice was skipped or failed: unverified mailbox, new browser, password, closed account, card status. No letter body |
| `account.claim` | Trainer claim |
| `account.password` | Password chosen after the short Instagram link. The row has no password |
| `email.send` / `email.dev` / `email.review` | Postfix or Resend, dev console, review mail. The letter is HTML. Do not store the body, a code, or a link |
| `sms.send` / `sms.dev` | SMS.BY, or the dev console without the code |
| `form.welcome` / `form.review` / `form.trainer_admin` / `form.trainer_profile` / `form.trainer_contacts` / `form.nick_support` | Public and cabinet forms. `form.trainer_contacts` stores Instagram and Telegram on the trainer card. `form.welcome` sends the same contacts to `SITE_EMAIL` and awaits the insert only after that letter is accepted. A refused letter is `outcome: failure` and leaves no row. The journal still has no letter body. `target` is the Instagram or Telegram handle. A phone is `subject` as a mask, and a phone-only welcome leaves `target` empty. The welcome row stores `+375 29 123-45-67`, not the raw field. A honeypot is `denied` with `reason: honeypot` and no handle. `form.nick_support` is a nick-change request: the row stores the slug and the character count, not the request text. |
| `map.area` | `listMapAreaFn` |
| `map.locate` | Browser geolocation on `/map` and `/search`. Warn only. The visitor sees no note. The row has no coordinates. |
| `geo.cache.read` / `geo.cache.write` / `geo.profile` / `geo.suggest` / `geo.visitor` | Geocoder, address suggestions, and visitor place. `geo.suggest` and `geo.profile` log a failure when the map service does not answer. The row does not store the address text |
| `message.send` / `message.file` / `message.ensure` / `message.close` / `message.reopen` / `message.report` / `message.dismiss` / `message.block` / `message.notify` / `message.push` / `message.welcome` | Message mutations, attachment upload, and notices. `message.welcome` is the portal greeting to a new trainer. Log the size and extension, not the file name, the file body, or the welcome text. A download is logged only when it fails |
| `message.list` / `message.thread` / `message.read` / `message.unread` / `message.hide` | Failures only |
| `admin.review` | Review publish or reject |
| `admin.welcome` | Staff marks a trainer application done or rejected. The row stores the handle or the application id, not the phone |
| `admin.trainer_outreach` | The first Instagram outreach was marked sent. The row stores the slug, not the message |
| `admin.sync_marks` | The laptop synced message, link, and visit marks. The row stores the count, not the short link |
| `admin.sync_trainer` | The laptop synced one imported draft and its photos. The row stores the handle |
| `admin.sync_trainers` | The laptop synced trainer cards, catalog status, and message marks. The row stores counts or one handle, not the card text or the short link |
| `admin.trainer_invite` | Staff copied the trainer's short link. The row stores the slug, not the link. A published profile is `denied` |
| `admin.trainer_invite_sent` | The copied short link was marked sent. The row stores the slug, not the link |
| `admin.trainer_note` | Staff saved a trainer note. The row stores the slug, not the note text |
| `admin.trainer_remove` | A trainer profile was removed from the portal. The row stores the slug |
| `trainer.add` / `trainer.sync` | A trainer card was inserted, or an import updated an existing card. The row stores the slug, status, and source. Card text stays out |
| `trainer.appear` / `trainer.withdraw` | The card entered or left the public catalog. Timestamp is `created_at` |
| `catalog.trainer_preview` / `catalog.trainer_edit` / `catalog.trainer_save` / `catalog.trainer_publish` | Profile preview and edit links. They stay valid until the profile is published, then open the public trainer URL. A missing link is `denied`. Tokens and URLs stay out of the row |
| `catalog.list` | Published catalog list failed. Success is not stored |
| `catalog.sitemap` | The sitemap could not read published trainer profiles. The rest of the file is still served. Success is not stored |
| `catalog.share` | The messenger card could not be drawn. A missing trainer photo or category picture is a 404 and is not stored |
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

`redactContext` replaces values whose keys match password, token, secret, otp, cookie, session, body, text, html, or `code`. `safeRoute` drops the query string. Stacks are truncated to 4000 characters and bearer tokens are stripped. Journal rows have no expiry.

`trainer_journal` keeps the trainer copy. Copied actions are `trainer.*`, `catalog.trainer*`, `admin.trainer*`, `form.trainer*`, `form.nick_support`, `form.welcome`, `account.claim`, `account.password`, and `message.welcome`. Auth, account, SMS, and service-mail actions are copied only when the actor is a trainer or a club, or owns the card. Map frames, polls, and message bodies are not copied. The row stores the timestamp, slug, actor, and redacted message. It does not store a stack, IP, or letter.
