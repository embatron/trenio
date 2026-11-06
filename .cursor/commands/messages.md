# Send Instagram outreach

Same run as `/send-msgs`. The words written after `/messages` are arguments, not a note beside a full batch.

## Project context

- Follow `.cursor/skills/trenio-send-msgs/SKILL.md` for the whole run.
- The message is the outreach in site settings. It does not include the magic link. The words `trenio by` are sent as the link `https://trenio.by`.
- The magic link stays on the trainer row. An admin copies it afterwards and sends it by hand.
- A sent message sets «Сообщение». Copying the link sets «Ссылка». Opening `/hi/{code}` sets «Заход».

## Arguments

The rest of this message is the scope. Follow it. Do not message every unmarked draft when the user named someone, set a count, or said to skip.

- Handles and Instagram profile URLs are the whole batch, in the written order.
- A count takes that many unmarked drafts from the top of the list.
- «Не отправляй», «только список», and «кроме …» are obeyed.
- Pass those handles to `scripts/outreach-trainers.ts list`. Send only rows with `send: true`.

## Do this now

1. Read the skill, `scripts/ig-session.fn.js`, and the arguments above.
2. Open `https://www.instagram.com/accounts/edit/` in the import Chrome window. Continue only when the username is `trenioby`. On a login wall, sign in once from `LOGIN.md` and check again. Do not print the password. If the account is anyone else, stop.
3. List the scope with `IG_ACCOUNT=trenioby` and `scripts/outreach-trainers.ts list`, plus the written handles when there are any.
4. For each handle in that scope, open that Instagram profile. Send only when the URL handle is that row and the row is still unmarked.
5. If the outreach is already there, mark the handle sent and do not type again.
6. Otherwise send the outreach text only.
7. Run `scripts/outreach-trainers.ts mark {handle}` after a send or a confirmed existing thread. That writes the mark on the laptop and on the live site.
8. After the batch, run `scripts/sync-remote.ts marks`.
9. On a checkpoint, stop the batch.
10. Report each handle, including the ones the arguments skipped. Close the Playwright page.

## Result

- The batch started only after the browser showed the account `trenioby`.
- Only the accounts named in the arguments were handled. With no arguments, the run is the unmarked drafts.
- Each handled draft has a message mark on the laptop and on the live site, or a stated reason it was skipped.
- The short link is ready to copy. It was not pasted into the direct message.
