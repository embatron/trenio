---
name: trenio-send-ready
description: >-
  Sends the combined Instagram letter from the trenioby account. The letter
  introduces the project and says the page is already assembled, then includes
  that trainer's short link and substitutes only the given name. Use when the
  user runs /send-ready or asks to send the letter that the project is being
  created and the page is already ready to look at. Handles, a count, and
  other words written with the command are the scope.
---

# Project and prepared page

This letter joins the two older ones. It says the catalog is being created and that this trainer's page is already assembled, then asks them to look. It is not the cold outreach and it does not mention an application.

`/send-msgs` stays the ask with no short link. `/send-claim` stays the application letter. Do not send either of those from this command.

The saved text is `DEFAULT_READY_INSTAGRAM_MESSAGE` in `src/lib/site-texts/defaults.ts`. The only substitutions are the given name and that trainer's short link. Do not add a sport, a city, a price, or any other fact from the profile.

## Arguments

The text after `/send-ready` chooses who receives the letter.

- Handles, `@handles`, and `instagram.com` profile URLs are the only recipients, in the written order.
- A count takes that many unmarked drafts from the top of the list.
- «Не отправляй», «только список», and «кроме …» are obeyed.
- No arguments means every unmarked draft.

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts list handle-one
```

Send only rows with `send: true`. `published`, `sent`, `not-draft`, `missing`, and `silent` are reported and skipped. `latysheu` is `silent`: do not open that profile and do not write. A published card is never messaged. A card that already has «Сообщение» is never messaged again.

## Do

- Read `.cursor/skills/trenio-vps/SKILL.md` before a server step. Do not print a password, a database URL, or `SYNC_TOKEN`.
- Open `https://www.instagram.com/accounts/edit/` and continue only when the signed-in account is `trenioby`. On a login wall, sign in from `LOGIN.md`. Do not print the password. On a checkpoint, stop.
- Set `IG_ACCOUNT=trenioby` only after that check.
- For each handle, print the finished letter and send that text unchanged:

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts text {handle} ready
```

`{hello}` becomes «Ирина, добрый день!» for the given name Ирина, or «Добрый день!» when the given name is empty. `{doorUrl}` is the short link read from that draft after the live site has answered. Do not reuse a link from an earlier message. If the command prints `published`, `sent`, `not-draft`, `missing`, or `link`, do not type anything.
- Keep the letter's line breaks. Paragraphs are separated by a blank line. The short link is the full `https://` address alone on its line, with a blank line above it and a blank line below it. That is what makes Instagram show the address as the link. The sentence above that gap ends with «посмотрите, всё ли на месте:». The letter also says «Участие для тренера бесплатное.» Instagram drops those breaks when the whole letter is inserted at once (`insertText` of the full string, `execCommand('insertText')`, or one paste). The paragraphs then run together, spaces disappear, and the short link sticks to the previous word. Do not send that.
- Type one line at a time. Split the letter on `\n`. For a line that has text, insert only that line. Then press Shift+Enter, including after a blank line, and skip Shift+Enter after the last line. Enter without Shift sends the message. Before Send, read the composer. It must equal the letter: the same lines, a blank line between paragraphs, a blank line above the link and a blank line below it, the spaces inside each sentence, and the sentence that participation is free for the trainer. If a break is missing or the link is glued to another line, clear the composer and type it again. Do not click Send until that check passes.
- Send only from `https://www.instagram.com/{handle}/` while that row is still an unmarked draft.
- Read the thread before typing. Scroll to the top. An older message above the fold still counts. Send only into a thread that has no messages. If this letter is already the only message, mark it sent and do not type again. If any other message is visible, from this account or from the trainer, do not type and do not mark. Say that the thread is not empty.
- Click Follow or «Подписаться» when Instagram will not open the composer until this account follows. That is a missing Message button, or a dialog that asks for a follow before the message can be sent. Click it once, wait until Message or «Написать» appears, then open the thread and read it again from the top. Type only when that second read still shows no messages. If Message is already on the profile, do not follow. If the button still does not appear, skip the profile. Do not click Like or Comment.
- After a real send, or after finding this letter as the only message in the thread, set both first marks. «Сообщение» is the letter. «Ссылка» is the short link inside it. Do not mark a thread that contains any other message:

```bash
IG_ACCOUNT=trenioby ./node_modules/.bin/tsx --env-file=.env scripts/outreach-trainers.ts mark {handle} ready
```

`mark` without `ready` or `claim` is the cold outreach and leaves «Ссылка» empty.

- Then `scripts/sync-remote.ts marks`.
- Pause about 45 seconds between profiles.
- Close the Playwright page when the batch ends.

## Do not

- Rewrite the letter, list sports, or fill a field the template does not name.
- Use the cold `instagram_message` text or the application letter from `/send-claim`.
- Mention an application. This letter does not say the trainer applied.
- Leave «Ссылка» empty. This letter contains the short link, so `mark {handle} ready` sets it together with «Сообщение».
- Message a published, hidden, or archived card, or a draft that already has a message mark.
- Type a short link that `text {handle} ready` did not just print for this handle.
- Insert the whole letter in one step. A single `insertText`, `execCommand('insertText')`, or paste drops the line breaks. The short link must stay alone between two blank lines.
- Send into a thread that already has any other message. Reading only the bottom of the thread is not enough.
- Follow a profile that already shows Message, or type before the thread has been read again after a follow.
- Drop the sentence «Участие для тренера бесплатное.»
- Run `text {handle}` without `ready`. That prints the application letter.

## Report

One line per handle: name, sent or skipped, and why. A skipped thread says it was not empty. A sent letter says the short link was alone between two blank lines. The profile stays a draft.
