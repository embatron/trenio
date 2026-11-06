---
name: trenio-send-msgs
description: >-
  Sends the first Instagram direct message from trenioby to imported trainer
  drafts whose message is not sent yet. Checks the signed-in account and the
  open profile before sending, then marks the message on the laptop and on
  the live site. Use for /send-msgs.
---

# Send the first Instagram message

The first message asks whether the trainer wants to join. It does not contain the short link. An admin copies that link afterwards from `/admin/trainers` and sends it by hand.

## Do

- Read `.cursor/skills/trenio-vps/SKILL.md` before any server step. Do not print a password, a database URL, a short-link code, or `SYNC_TOKEN`.
- Before the batch, prove the import Chrome window is signed in as `trenioby`. Open `https://www.instagram.com/accounts/edit/` and evaluate `scripts/ig-session.fn.js`. The username field must be exactly `trenioby`. If a login wall is up, sign in once from `LOGIN.md` and check again. If the username is anything else, stop. Do not send.
- Set `IG_ACCOUNT=trenioby` only after that check. `scripts/outreach-trainers.ts` refuses to list or mark without it.
- Send only to a draft whose `outreach_sent_at` is empty. The list comes from `scripts/outreach-trainers.ts list`.
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

## Text

Load the saved site text. If it is empty or contains `{doorUrl}`, send `DEFAULT_INSTAGRAM_MESSAGE` from `src/lib/site-texts/defaults.ts`.

```bash
./node_modules/.bin/tsx --env-file=.env -e 'import { loadSiteText } from "./src/lib/site-texts/store.ts"; import { outreachTemplate } from "./src/lib/site-texts/defaults.ts"; console.log(outreachTemplate(await loadSiteText("instagram_message")));'
```

The default text is the invitation that starts with «Добрый день!)» and names https://trenio.by. It does not include a personal short link.

## Flow

```
Send progress:
- [ ] accounts/edit username is trenioby
- [ ] List drafts with no message mark
- [ ] For each handle: the open profile is that handle and the mark is still empty
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

Each row is a draft with an Instagram handle and an empty message mark. `{ "ok": false, "reason": "account" }` means the account check was skipped. Stop.

### 3. Check the profile

`browser_navigate` to `https://www.instagram.com/{handle}/`, then `browser_snapshot`. The handle in the URL must be the row you are about to message, and that row must still be in the list. Open Message (the button may be «Message» or «Написать»). Read the thread. Treat the outreach as already sent when the thread contains «Добрый день!)» and `trenio.by` from `trenioby`. Do not send a second copy.

### 4. Send

Click the composer, insert the outreach text, and send. Wait until that text is visible in the thread. Do not attach the short link.

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
