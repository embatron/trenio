# Send the application welcome

Send the prepared-page letter from the `trenioby` Instagram account. The letter substitutes the trainer's given name and includes that trainer's short link.

## Project context

- Follow `.cursor/skills/trenio-send-claim/SKILL.md` for the whole run.
- The letter is `DEFAULT_CLAIM_INSTAGRAM_MESSAGE`. Do not send the cold outreach from `/send-msgs`, and do not add sports or other profile facts.
- A sent message sets «Сообщение». The short link is inside this letter. Copying the link in the admin table is still what sets «Ссылка».

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
4. For each handle, run `scripts/outreach-trainers.ts text {handle}`. Send that text only when it is the letter. `published`, `sent`, `not-draft`, `missing`, and `link` mean do not type. The short link in the letter is the one stored on that draft.
5. Send only when the open profile is that handle, the row is still an unmarked draft, and the thread is empty. If this letter is already in the thread, mark it and do not type again. If Instagram will not accept the message until this account follows, click Follow once and then send. Do not follow when Message is already there.
6. Run `scripts/outreach-trainers.ts mark {handle}` after a send or a confirmed existing letter.
7. After the batch, run `scripts/sync-remote.ts marks`.
8. On a checkpoint, stop the batch.
9. Report each handle. Close the Playwright page.

## Result

- The batch started only after the browser showed the account `trenioby`.
- A published trainer and a trainer who already received a message were skipped.
- Each letter uses that trainer's given name and the short link just read from that draft. No sport or other profile fact was added.
- Follow was clicked only when Instagram required it before the message could be sent.
- Each handled draft has a message mark on the laptop and on the live site, or a stated reason it was skipped.
- The profile stays a draft.
