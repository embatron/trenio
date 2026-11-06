# Send Instagram outreach

Send the first direct message from the `trenioby` Instagram account to imported drafts whose message is not sent yet.

## Project context

- Follow `.cursor/skills/trenio-send-msgs/SKILL.md` for the whole run.
- The message is the outreach in site settings. It does not include the magic link.
- The magic link stays on the trainer row. An admin copies it afterwards and sends it by hand.
- A sent message sets «Сообщение». Copying the link sets «Ссылка». Opening `/hi/{code}` sets «Заход».

## Do this now

1. Read the skill and `scripts/ig-session.fn.js`.
2. Open `https://www.instagram.com/accounts/edit/` in the import Chrome window. Continue only when the username is `trenioby`. On a login wall, sign in once from `LOGIN.md` and check again. Do not print the password. If the account is anyone else, stop.
3. List drafts with `IG_ACCOUNT=trenioby` and `scripts/outreach-trainers.ts list`.
4. For each handle, open that Instagram profile. Send only when the URL handle is that row and the row is still unmarked.
5. If the outreach is already there, mark the handle sent and do not type again.
6. Otherwise send the outreach text only.
7. Run `scripts/outreach-trainers.ts mark {handle}` after a send or a confirmed existing thread. That writes the mark on the laptop and on the live site.
8. After the batch, run `scripts/sync-remote.ts marks`.
9. On a checkpoint, stop the batch.
10. Report each handle. Close the Playwright page.

## Result

- The batch started only after the browser showed the account `trenioby`.
- Each handled draft has a message mark on the laptop and on the live site, or a stated reason it was skipped.
- The short link is ready to copy. It was not pasted into the direct message.
