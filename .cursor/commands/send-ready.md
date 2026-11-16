# Send the project and the prepared page

Send the combined letter from the `trenioby` Instagram account. The letter says the catalog is being created and that this trainer's page is already assembled, then includes that trainer's short link.

## Project context

- Follow `.cursor/skills/trenio-send-ready/SKILL.md` for the whole run.
- The letter is `DEFAULT_READY_INSTAGRAM_MESSAGE`. Do not send the cold outreach from `/send-msgs` or the application letter from `/send-claim`. Do not add sports or other profile facts. Do not mention an application.
- A sent letter sets «Сообщение» and «Ссылка». The short link is inside the letter. `mark {handle} ready` writes both.

## Arguments

The rest of this message is the scope. Do not message every unmarked draft when the user named someone, set a count, or said to skip.

- Handles and Instagram profile URLs are the whole batch, in the written order.
- A count takes that many unmarked drafts from the top of the list.
- «Не отправляй», «только список», and «кроме …» are obeyed.
- Pass those handles to `scripts/outreach-trainers.ts list`. Send only rows with `send: true`.

## Do this now

1. Read the skill and the arguments above.
2. Open `https://www.instagram.com/accounts/edit/` in the import Chrome window. Continue only when the account is `trenioby`. On a login wall, sign in once from `LOGIN.md` and check again. Do not print the password. If the account is anyone else, stop.
3. List the scope with `IG_ACCOUNT=trenioby` and `scripts/outreach-trainers.ts list`.
4. For each handle, run `scripts/outreach-trainers.ts text {handle} ready`. Send that text only when it is the letter. `published`, `sent`, `not-draft`, `missing`, and `link` mean do not type. The short link in the letter is the one stored on that draft.
5. Open that profile and read the thread before typing. Scroll to the top so an older message is not missed. Send only when the open profile is that handle, the row is still an unmarked draft, and the thread has no messages. If this letter is already the only message, mark it and do not type again. If any other message is visible — from this account or from the trainer — do not type and do not mark. Say that the thread is not empty.
6. If the message cannot be opened until this account follows, click Follow or «Подписаться» once, wait until Message or «Написать» appears, then open the thread and read it again from the top. Follow does not skip that second read. Type only when that second read still shows no messages. If Message is already on the profile, do not follow. If the button still does not appear, skip the profile.
7. Type the letter one line at a time with Shift+Enter between lines, including every blank line. The short link is the full `https://` address alone on its line, with a blank line above it and a blank line below it, so Instagram shows it as the link. Do not insert the whole letter at once: Instagram then drops the breaks, the spaces collapse, and the link sticks to the previous word. Read the composer before Send. It must equal the letter, including both blank lines around the link and the sentence that participation is free for the trainer. If a break is missing or the link is glued to another line, clear the composer and type it again. Do not send the collapsed line.
8. Run `scripts/outreach-trainers.ts mark {handle} ready` after a send, or after a thread whose only message is this letter. That sets «Сообщение» and «Ссылка». Do not mark a thread that contains any other message.
9. After the batch, run `scripts/sync-remote.ts marks`.
10. On a checkpoint, stop the batch.
11. Report each handle, including a thread that was not empty. Close the Playwright page.

## Result

- The batch started only after the browser showed the account `trenioby`.
- A published trainer and a trainer who already received a message were skipped.
- Each letter uses that trainer's given name and the short link just read from that draft. The short link is the only text on its line, with a blank line above and a blank line below. The letter says participation is free for the trainer. No sport or other profile fact was added. The letter does not say the trainer applied.
- The thread was read from the top before typing. A thread with any other message was left unsent and unmarked.
- Follow was clicked once when Instagram required it before the message could be opened, and the thread was read again after that click.
- Each handled draft has the message mark and the link mark on the laptop and on the live site, or a stated reason it was skipped.
- The profile stays a draft.
