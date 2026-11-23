# Send Instagram outreach

Send the first direct message from the `trenioby` Instagram account to imported drafts whose message is not sent yet. With no named accounts, take the oldest drafts from the site database and send only where the Instagram dialog is empty. Wait a different interval of 5–10 minutes after each send. Every other letter is two bubbles, and neighboring letters change a few words without changing the offer.

## Project context

- Follow `.cursor/skills/trenio-send-msgs/SKILL.md` for the whole run.
- The message is the outreach in site settings. It does not include the magic link. The words `trenio by` are sent as the link `https://trenio.by`. Do not send the `/send-claim` letter or the `/send-ready` letter from this command.
- The magic link stays on the trainer row. An admin copies it afterwards and sends it by hand.
- A sent message sets «Сообщение». Copying the link sets «Ссылка». Opening `/hi/{code}` sets «Заход».

## Arguments

The rest of this message is the scope. Follow it. Do not message every unmarked draft when the user named someone, set a count, or said to skip.

- Handles and Instagram profile URLs are the whole batch, in the written order.
- A count takes that many unmarked drafts from the oldest accounts in the site database.
- «Не отправляй», «только список», and «кроме …» are obeyed.
- Pass those handles to `scripts/outreach-trainers.ts list`. Send only rows with `send: true`.
- With no arguments, the list is every unmarked draft, oldest `created_at` first. A named list keeps the written order.

## Do this now

1. Read the skill, `scripts/ig-session.fn.js`, and the arguments above.
2. Open `https://www.instagram.com/accounts/edit/` in the import Chrome window. Continue only when the username is `trenioby`. On a login wall, sign in once from `LOGIN.md` and check again. Do not print the password. If the account is anyone else, stop.
3. List the scope with `IG_ACCOUNT=trenioby` and `scripts/outreach-trainers.ts list`, plus the written handles when there are any. With no handles, that list is the site database: drafts with an empty message mark, oldest added account first.
4. For each handle in that order, open that Instagram profile. The URL handle must be that row, and the row must still be unmarked.
5. Open Message. If our outreach is already in the thread, mark the handle sent and do not type again.
6. If the dialog already has any other message, or the profile has no Message button, skip it and leave the mark empty.
7. If the dialog is empty, send the outreach text only. Odd places are one bubble. Even places are two bubbles: the greeting «Имя, здравствуйте!», then the rest of the letter a few seconds later. Change a few words from the previous letter. Keep the catalog, the invitation, the question, that it is free, and `https://trenio.by`. Then wait a random 5–10 minutes. The next wait must be a different length, at least 30 seconds away from the previous one. A skipped profile waits 45–90 seconds instead.
8. Run `scripts/outreach-trainers.ts mark {handle}` after a send or a confirmed existing thread. That writes the mark on the laptop and on the live site.
9. After the batch, run `scripts/sync-remote.ts marks`.
10. On a checkpoint, stop the batch.
11. Report each handle, including the ones the arguments skipped and the ones whose dialog was not empty. Close the Playwright page.

## Result

- The batch started only after the browser showed the account `trenioby`.
- Only the accounts named in the arguments were handled. With no arguments, the run is the oldest unmarked drafts from the site database, and a message is sent only into an empty Instagram dialog.
- Sends are separated by unequal pauses of 5–10 minutes. Even places are two bubbles. Neighboring letters are not identical.
- Each handled draft has a message mark on the laptop and on the live site, or a stated reason it was skipped. A dialog that was not empty stays unmarked.
- The short link is ready to copy. It was not pasted into the direct message.
