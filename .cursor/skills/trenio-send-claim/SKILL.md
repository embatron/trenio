---
name: trenio-send-claim
description: >-
  Sends the application welcome from the trenioby Instagram account. The letter
  says the page is already prepared, includes that trainer's short link, and
  substitutes only the given name. Use when the user runs /send-claim or asks
  to send the application welcome. Handles, a count, and other words written
  with the command are the scope.
---

# Application welcome

This is the letter for a trainer whose page is already prepared. It is not the cold outreach. `/send-msgs` stays that other letter and still has no short link.

The saved text is `DEFAULT_CLAIM_INSTAGRAM_MESSAGE` in `src/lib/site-texts/defaults.ts`. The only substitutions are the given name and that trainer's short link. Do not add a sport, a city, a price, or any other fact from the profile.

## Arguments

The text after `/send-claim` chooses who receives the letter.

- Handles, `@handles`, and `instagram.com` profile URLs are the only recipients, in the written order.
- A count takes that many unmarked drafts from the top of the list.
- «Не отправляй», «только список», and «кроме …» are obeyed.
- No arguments means every unmarked draft.

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts list handle-one
```

Send only rows with `send: true`. `published`, `sent`, `not-draft`, and `missing` are reported and skipped. A published card is never messaged. A card that already has «Сообщение» is never messaged again.

## Do

- Read `.cursor/skills/trenio-vps/SKILL.md` before a server step. Do not print a password, a database URL, or `SYNC_TOKEN`.
- Open `https://www.instagram.com/accounts/edit/` and continue only when the signed-in account is `trenioby`. On a login wall, sign in from `LOGIN.md`. Do not print the password. On a checkpoint, stop.
- Set `IG_ACCOUNT=trenioby` only after that check.
- For each handle, print the finished letter and send that text unchanged:

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts text {handle}
```

`{hello}` becomes «Ирина, добрый день!» for the given name Ирина, or «Добрый день!» when the given name is empty. `{doorUrl}` is the short link read from that draft after the live site has answered. Do not reuse a link from an earlier message. If the command prints `published`, `sent`, `not-draft`, `missing`, or `link`, do not type anything.
- Send only from `https://www.instagram.com/{handle}/` while that row is still an unmarked draft.
- Send only into an empty thread. If this same letter is already there, mark it sent and do not type again. If any other message is already in the thread, skip it and say so.
- Click Follow or «Подписаться» only when Instagram will not open the composer until this account follows. That is a missing Message button, or a dialog that asks for a follow before the message can be sent. Click it once, wait until Message or «Написать» appears, then send. If Message is already on the profile, do not follow. If the button still does not appear, skip the profile. Do not click Like or Comment.
- After a real send, or after finding this letter already in the thread, set both first marks. «Сообщение» is the letter. «Ссылка» is the short link inside it:

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts mark {handle} claim
```

`mark` without `claim` is the cold outreach and leaves «Ссылка» empty.

- Then `scripts/sync-remote.ts marks`.
- Pause about 45 seconds between profiles.
- Close the Playwright page when the batch ends.

## Do not

- Rewrite the letter, list sports, or fill a field the template does not name.
- Use the cold `instagram_message` text for this command.
- Leave «Ссылка» empty. This letter contains the short link, so `mark {handle} claim` sets it together with «Сообщение».
- Message a published, hidden, or archived card, or a draft that already has a message mark.
- Type a short link that `text` did not just print for this handle.
- Follow a profile that already shows Message.

## Report

One line per handle: name, sent or skipped, and that the short link was inside the letter. The profile stays a draft.
