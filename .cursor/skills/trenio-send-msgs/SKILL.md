---
name: trenio-send-msgs
description: >-
  Sends the first Instagram direct message from trenioby to imported trainer
  drafts whose message is not sent yet. Follows the handles, limit, and
  other arguments written with /messages or /send-msgs instead of messaging
  every unmarked draft. Checks the signed-in account and the open profile
  before sending, then marks the message on the laptop and on the live site.
---

# Send the first Instagram message

The first message asks whether the trainer wants to join. It does not contain the short link. An admin copies that link afterwards from `/admin/trainers` and sends it by hand.

## Arguments

The text after `/messages` or `/send-msgs` is part of the command. Read it before opening Instagram. It chooses who is in this run.

- Handles, `@handles`, and `instagram.com` profile URLs are the only recipients. Keep the order the user wrote. Do not add the rest of the unmarked drafts.
- A count («только 2», «первых трёх», «одного») takes that many from the unmarked list, from the top. It does not mean everyone.
- A sentence that skips, delays, or limits someone is followed. «Не отправляй», «только список», «кроме …» means do that and do not send the skipped ones.
- A named account that is already sent, published, hidden, archived, or missing is reported with that reason. Do not replace them with another draft.
- No arguments means every unmarked draft, which is the only case for the full list.

Pass the written handles to the list command so the script applies the same limit:

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts list handle-one handle-two
```

Each row has `send`. Send only where `send` is true. `sent`, `not-draft`, and `missing` are reported and skipped.

## Do

- Read `.cursor/skills/trenio-vps/SKILL.md` before any server step. Do not print a password, a database URL, a short-link code, or `SYNC_TOKEN`.
- Before the batch, prove the import Chrome window is signed in as `trenioby`. Open `https://www.instagram.com/accounts/edit/` and evaluate `scripts/ig-session.fn.js`. The username field must be exactly `trenioby`. If a login wall is up, sign in once from `LOGIN.md` and check again. If the username is anything else, stop. Do not send.
- Set `IG_ACCOUNT=trenioby` only after that check. `scripts/outreach-trainers.ts` refuses to list or mark without it.
- Send only to a draft whose `outreach_sent_at` is empty and who is inside the arguments above. With no arguments, the list comes from `scripts/outreach-trainers.ts list`.
- Before typing, the open profile URL must be `https://www.instagram.com/{handle}/` for a handle that is still on that list. If the page is a different account, do not send.
- If the thread already contains this outreach, do not send again. Mark it sent and continue.
- After a real send, or after finding the outreach already in the thread, run `scripts/outreach-trainers.ts mark {handle}`. That sets the message mark on the laptop and on the live site, and prepares one short link.
- After the batch, run `scripts/sync-remote.ts marks` so every mark on the laptop is on the live site.
- Pause about 45 seconds between profiles. Stop the rest of the batch on a checkpoint or a block.

## Do not

- Put the `/hi/{code}` link, `{doorUrl}`, or `{gaps}` in the direct message.
- Click Follow, Like, or Comment.
- Mark the link as sent. The link column changes only when an admin copies the link in the trainer table.
- Message a published, hidden, or archived card. The list is drafts only.
- Send the older site text when it still contains `{doorUrl}`. Use the default outreach instead.
- Start the batch from memory of the last login. The accounts/edit check is required every run.
- Ignore the handles, count, or limits written with the command and message every unmarked draft instead.

## Text

Load the saved site text. If it is empty or contains `{doorUrl}`, send `DEFAULT_INSTAGRAM_MESSAGE` from `src/lib/site-texts/defaults.ts`.

```bash
./node_modules/.bin/tsx --env-file=.env -e 'import { loadSiteText } from "./src/lib/site-texts/store.ts"; import { outreachHello, outreachTemplate, outreachWithSiteLink } from "./src/lib/site-texts/defaults.ts"; const run = async () => { console.log(outreachWithSiteLink(outreachTemplate(await loadSiteText("instagram_message")).replaceAll("{hello}", outreachHello("Анна")))); }; run();'
```

The default text starts with `{hello}`. Replace that with the trainer's given name and «добрый день!»: «Анна, добрый день!». When the given name is empty, the line is «Добрый день!». The letter does not include a personal short link.

The words `trenio by` are the site link. Before typing, turn them into `https://trenio.by` with `outreachWithSiteLink` from `src/lib/site-texts/defaults.ts`. Instagram makes that address the link. Do not type the bare words `trenio by` or `trenio.by`. Do not send until the composer contains `https://trenio.by`.

## Flow

```
Send progress:
- [ ] accounts/edit username is trenioby
- [ ] Read the arguments and keep only that scope
- [ ] List that scope, not every unmarked draft
- [ ] For each handle in scope: the open profile is that handle and the mark is still empty
- [ ] If our outreach is already in the thread, mark sent and skip
- [ ] Otherwise type the outreach and send it
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

With no arguments, each row is a draft with an Instagram handle and an empty message mark. With arguments, pass those handles and send only rows whose `send` is true. `{ "ok": false, "reason": "account" }` means the account check was skipped. Stop.

### 3. Check the profile

`browser_navigate` to `https://www.instagram.com/{handle}/`, then `browser_snapshot`. The handle in the URL must be the row you are about to message, and that row must still be in the list. Open Message (the button may be «Message» or «Написать»). Read the thread. Treat the outreach as already sent when the thread from `trenioby` contains `trenio.by` and a greeting («добрый день» or the older «Добрый день!)»). Do not send a second copy.

### 4. Send

Click the composer, insert the outreach text, and send. The words `trenio by` are already replaced by `https://trenio.by`. Wait until that address is visible in the thread. Do not attach the short link.

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
