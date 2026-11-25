---
name: trenio-send-msgs
description: >-
  Sends the first Instagram direct message from trenioby to imported trainer
  drafts whose message is not sent yet. With no named accounts, takes the
  oldest drafts from the site database and sends only into an empty Instagram
  dialog, with a different 5–10 minute pause after each send. Every
  other letter is two bubbles, and neighboring letters change a few words
  without changing the offer. Follows the
  handles, limit, and other arguments written with /messages or /send-msgs.
  Checks the signed-in account and the open profile before sending, then
  marks the message on the laptop and on the live site.
---

# Send the first Instagram message

The first message asks whether the trainer wants to join. It does not contain the short link. An admin copies that link afterwards from `/admin/trainers` and sends it by hand.

The application letter, for a page that is already prepared, is `/send-claim`. The combined letter, the project plus the page already assembled, is `/send-ready`. Do not send either letter from this command.

## Arguments

The text after `/messages` or `/send-msgs` is part of the command. Read it before opening Instagram. It chooses who is in this run.

- Handles, `@handles`, and `instagram.com` profile URLs are the only recipients. Keep the order the user wrote. Do not add the rest of the unmarked drafts.
- A count («только 2», «первых трёх», «одного») takes that many from the oldest unmarked drafts. It does not mean everyone.
- A sentence that skips, delays, or limits someone is followed. «Не отправляй», «только список», «кроме …» means do that and do not send the skipped ones.
- A named account that is already sent, published, hidden, archived, or missing is reported with that reason. Do not replace them with another draft.
- No arguments means every unmarked draft in the site database, oldest `created_at` first. That is the only case for the full list. A named list keeps the written order.

Pass the written handles to the list command so the script applies the same limit:

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts list handle-one handle-two
```

Each row has `send`. Send only where `send` is true. `sent`, `not-draft`, and `missing` are reported and skipped.

## Do

- Read `.cursor/skills/trenio-vps/SKILL.md` before any server step. Do not print a password, a database URL, a short-link code, or `SYNC_TOKEN`.
- Before the batch, prove the import Chrome window is signed in as `trenioby`. Open `https://www.instagram.com/accounts/edit/` and evaluate `scripts/ig-session.fn.js`. The username field must be exactly `trenioby`. If a login wall is up, sign in once from `LOGIN.md` and check again. If the username is anything else, stop. Do not send.
- Set `IG_ACCOUNT=trenioby` only after that check. `scripts/outreach-trainers.ts` refuses to list or mark without it.
- Send only to a draft whose `outreach_sent_at` is empty and who is inside the arguments above. With no arguments, the list comes from `scripts/outreach-trainers.ts list`, oldest added account first.
- Before typing, the open profile URL must be `https://www.instagram.com/{handle}/` for a handle that is still on that list. If the page is a different account, do not send.
- Send only when that Instagram dialog is empty. The profile header and the empty composer are not messages.
- If the thread already contains this outreach, do not send again. Mark it sent and continue.
- If the thread has any other message, or the profile has no Message button, leave the mark empty and take the next account.
- After a real send, or after finding the outreach already in the thread, run `scripts/outreach-trainers.ts mark {handle}`. That sets the message mark on the laptop and on the live site, and prepares one short link.
- After the batch, run `scripts/sync-remote.ts marks` so every mark on the laptop is on the live site.
- After a real send, wait a random interval from 5 to 10 minutes. The next interval must be a different length, at least 30 seconds away from the previous one. A skipped profile waits 45–90 seconds. Stop the rest of the batch on a checkpoint or a block.
- Every other person in the run gets two bubbles. Odd places stay one bubble. Even places start with the greeting alone, then the rest of the letter. The two bubbles are a few seconds apart. The 5–10 minute pause starts after the second bubble.
- Change a few words from one trainer to the next. Keep the offer: the catalog, the invitation, the question, and that it is free.

## Closed accounts

`latysheu` is closed. Do not open that Instagram profile and do not send any letter there: this outreach, the application welcome, or the prepared-page letter. The list returns `send: false` and `reason: "silent"`. Report it and leave the mark empty. This does not expire.

## Do not

- Open or message `latysheu`. The account is closed.
- Put the `/hi/{code}` link, `{doorUrl}`, or `{gaps}` in the direct message.
- Click Follow, Like, or Comment.
- Mark the link as sent. The link column changes only when an admin copies the link in the trainer table.
- Message a published, hidden, or archived card. The list is drafts only.
- Send the older site text when it still contains `{doorUrl}`. Use the default outreach instead.
- Start the batch from memory of the last login. The accounts/edit check is required every run.
- Ignore the handles, count, or limits written with the command and message every unmarked draft instead.
- Send into a dialog that already has messages.
- Use one fixed pause, the old 45-second pause, or the old 3–7 minute pause, between sends.
- Send the same wording to every trainer in the run.
- Split every letter, or split two neighbors in a row. Odd places stay one bubble.

## Text

Load the saved site text. If it is empty or contains `{doorUrl}`, send `DEFAULT_INSTAGRAM_MESSAGE` from `src/lib/site-texts/defaults.ts`.

```bash
./node_modules/.bin/tsx --env-file=.env -e 'import { loadSiteText } from "./src/lib/site-texts/store.ts"; import { outreachHello, outreachTemplate, outreachWithSiteLink } from "./src/lib/site-texts/defaults.ts"; const run = async () => { console.log(outreachWithSiteLink(outreachTemplate(await loadSiteText("instagram_message")).replaceAll("{hello}", outreachHello("Анна")))); }; run();'
```

The default text starts with `{hello}`. Replace that with the trainer's given name and a greeting. A one-bubble letter uses «Анна, добрый день!». A two-bubble letter uses «Анна, здравствуйте!» as the first bubble only. When the given name is empty, the line is «Добрый день!» or «Здравствуйте!». The letter does not include a personal short link.

The words `trenio by` are the site link. Before typing, turn them into `https://trenio.by` with `outreachWithSiteLink` from `src/lib/site-texts/defaults.ts`. Instagram makes that address the link. Do not type the bare words `trenio by` or `trenio.by`. Do not send a bubble until that bubble is complete. The bubble that carries the offer is not sent until the composer contains `https://trenio.by`.

### Pace

After the letter is in the thread, wait a random interval from 5 minutes to 10 minutes. Pick a new length each time, at least 30 seconds away from the previous wait. Do not repeat one length through the run. The two bubbles of one letter do not get this pause: send the second a few seconds after the greeting is visible. A skipped profile waits 45–90 seconds.

### Two bubbles

Count places in the run order, including a profile that is skipped. Place 1, 3, 5, and the other odd places are one bubble. Place 2, 4, 6, and the other even places are two bubbles.

The first bubble is only the greeting: «Анна, здравствуйте!». The second bubble is the rest of the letter, with no second greeting. Send it only after the greeting is visible. Mark the handle once, after the second bubble is in the thread.

### Wording

Neighboring letters are not identical. Change a few words. Keep the meaning.

Must stay:

- a greeting with the given name, or «Добрый день!» / «Здравствуйте!» when the name is empty
- the address `https://trenio.by`
- a catalog of trainers in Belarus that helps people find a specialist
- the profile was liked, and the trainer is invited to join
- a question whether they are interested
- participation and the extra promotion are free

May change: «добрый день» and «здравствуйте»; «развиваем», «собираем», and «делаем»; «единую базу» and «общий каталог»; «Нам очень понравился ваш профиль» and «Ваш профиль нам очень понравился»; «Подскажите» and «Скажите»; «абсолютно бесплатны» and «бесплатные».

Do not add a sport, a city, a price, or a short link. Do not drop the question or the fact that it is free.

A thread already contains this outreach when it has `trenio.by` and a greeting («добрый день», «здравствуйте», or the older «Добрый день!)»).

## Flow

```
Send progress:
- [ ] accounts/edit username is trenioby
- [ ] Read the arguments and keep only that scope. `latysheu` is closed: report `silent` and do not open it
- [ ] List that scope, oldest added account first when no handles were named
- [ ] For each handle in scope: the open profile is that handle and the mark is still empty
- [ ] If our outreach is already in the thread, mark sent and skip
- [ ] If the dialog has any other message, or there is no Message button, skip and leave the mark empty
- [ ] If the dialog is empty, type the outreach and send it. Even places are two bubbles
- [ ] Wait a different 5–10 minutes after that send
- [ ] Mark sent locally and on the live site
- [ ] Sync every mark
- [ ] Report handle, sent or already there, and that the link is ready to copy
```

### 1. Account

`browser_navigate` to `https://www.instagram.com/accounts/edit/`. Evaluate the function in `scripts/ig-session.fn.js`. Continue only when `username` is `trenioby`. On a login wall, sign in from `LOGIN.md` in that same window, then open accounts/edit again. Do not print the password. On a checkpoint, stop the batch.

### 2. List

From the repo root, after the account check:

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts list
```

With no arguments, each row is a draft from the site database with an Instagram handle and an empty message mark, oldest `created_at` first. With arguments, pass those handles and send only rows whose `send` is true. `{ "ok": false, "reason": "account" }` means the account check was skipped. Stop.

### 3. Check the profile

`browser_navigate` to `https://www.instagram.com/{handle}/`, then `browser_snapshot`. The handle in the URL must be the row you are about to message, and that row must still be in the list. Open Message (the button may be «Message» or «Написать»). Read the thread. Treat the outreach as already sent when the thread from `trenioby` contains `trenio.by` and a greeting («добрый день», «здравствуйте», or the older «Добрый день!)»). Do not send a second copy. Any other message means the dialog is not empty: do not type, do not mark, and take the next account. No Message button is the same skip.

### 4. Send

Click the composer, insert the outreach text, and send. The words `trenio by` are already replaced by `https://trenio.by`. On an even place, send «Имя, здравствуйте!» first, wait until that greeting is visible, then send the rest. Wait until `https://trenio.by` is visible in the thread. Do not attach the short link. Then wait a random 5–10 minutes before the next profile, and choose a different length from the previous wait, at least 30 seconds away. A skipped profile waits 45–90 seconds.

### 5. Mark

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts mark {handle}
```

A result of `{ "ok": true }` means the message mark is stored on the laptop and on the live site, and the short link exists. The admin copies it from the link icon. The visit column changes when the trainer opens that link.

### 6. Sync

```bash
./node_modules/.bin/tsx --env-file=.env scripts/sync-remote.ts marks
```

`{ "ok": true }` means the live site accepted the marks. Exit 2 means the route is not deployed yet; each `mark` already wrote the database through the server fallback. Do not print tokens.

### 7. Report

One line per handle: name, sent or already present, and that the short link is ready in the trainer table. Close the Playwright page when the batch ends.
