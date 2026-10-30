---
name: trenio-messages
description: >-
  Implements and changes Trenio.by direct messages (Сообщения): user to one
  published trainer or club profile, composer, emoji, unread counts, delivery
  and read receipts, moderation. Use when editing conversations, the message
  composer, «Написать», inbox, unread badges, or files under src/lib/messages,
  src/components/messages, or the account, me, and admin message routes.
---

# Direct messages

Read `.cursor/rules/messages.mdc` first. Product copy and limits are in `docs/TECH_SPEC.md` §4.6. This skill is the edit map.

## Files

| Concern | Location |
| --- | --- |
| Tables | `src/db/schema/messages.ts`. Apply attachment SQL with `npm run messages:install`, not `db:push` |
| File rules and storage | `src/lib/messages/attachments.ts`, `src/lib/messages/attachment-store.ts`, `src/lib/messages/file-download.ts` |
| Access, send, read cursor, unread SQL | `src/lib/messages/service.ts` |
| Zod and preview | `src/lib/messages/schemas.ts` |
| Server functions | `src/lib/messages/functions.ts` |
| Poll interval | `src/lib/messages/polling.ts` |
| Email and Telegram debounce | `src/lib/messages/notify.ts` |
| HTML allow-list and grapheme length | `src/lib/catalog/review-html.ts` |
| Emoji groups, including vulgar and skin tones | `src/lib/emoji-catalog.ts` |
| Composer, editor, bubbles, live unread | `src/components/messages/` |
| Header count | `MessageCount` in `src/components/site-chrome.tsx` |
| Routes | `src/routes/account.messages*.tsx`, `me.messages*.tsx`, `admin.messages.tsx` |

Do not import `src/db/` or `src/auth/` from those client components. Do not hand-edit `src/routeTree.gen.ts`.

## Logging

Message mutations log `domain: "message"` through `writeLog` in `src/lib/messages/functions.ts`. Store the conversation id in `target` and the visible length in `chars`. Do not write the HTML body, the preview, or the notification text into `app_logs`. List, thread, read, and unread polls log only failures. See `.cursor/rules/logging.mdc`.

## Access

1. Resolve the published profile by slug. Unpublished or missing profiles cannot be messaged.
2. Open or create the one `open` row for `(user_id, trainer_profile_id)`. A second open row hits the partial unique index.
3. `assertConversationAccess` decides read, write, close, reopen, block. Staff may read any thread. Staff write only when they are the initiator or the owner.
4. `sendMessage` is idempotent on `(conversation_id, client_id)` via `ON CONFLICT DO NOTHING`.
5. `consumeRateLimit` still caps sends: 10 per minute and 300 per day. A separate durable check allows one user to message at most 10 distinct trainer profiles per Europe/Minsk calendar day. A repeat to a trainer already messaged that day is allowed. The profile owner's replies are not counted. The 11th trainer is refused with `DAILY_TRAINER_LIMIT_MESSAGE`, and the cabinet shows that text in `CabinetNotice`.

## Send path

1. `sanitizeReviewHtml` before the length check. The same tags as reviews: `b`, `strong`, `i`, `em`, `ul`, `ol`, `li`, `p`, `br`, and safe `a`.
2. `reviewTextLength` counts graphemes. First message from the initiator: `FIRST_MESSAGE_MAX_LENGTH` (1000). Every later message: `MESSAGE_MAX_LENGTH` (4000). Stored HTML: `MESSAGE_HTML_MAX_LENGTH` (12000). Attachments do not count toward that limit. An empty body is stored only when at least one attachment is linked.
3. On Ctrl+Enter or ⌘+Enter, send `composerBody(editor.innerHTML, state)`. The visible field wins when React state is still empty. Plain Enter stays a line break.
4. Insert and set `last_message_at` in one transaction. Do not hide or delete the conversation. A participant has no such action. The thread is removed for both sides only when an account is deleted.
5. Notify the other party through `scheduleMessageNotification` (2 minute debounce, no message body). Skip when `last_read_at` is under 30 seconds and `last_read_message_id` already covers this id.

## Receipts and unread

- `conversation_reads.last_read_message_id` is a bigint with no foreign key.
- For the sender, the other reader is the profile owner when the viewer is the initiator, and the initiator when the viewer is the owner. No owner means the receipt stays `delivered`.
- `receipt` is `read` when that cursor is greater than or equal to the message id, otherwise `delivered`. The bubble copy is «Прочитано» or «Доставлено». Pending client sends show «Отправка…».
- `unreadSummary` is one SQL: `{ own, inbox, total, ownedSlugs }`. Root `beforeLoad` loads it. `MessagesLive` repeats `unreadCountFn` every `MESSAGE_SCAN_MS` while the tab is visible.
- Opening a thread calls `markConversationRead` for the newest id, then `router.invalidate()` so the header count drops.

## UI

- Account, trainer, and admin nav labels are «Сообщения». Badges are `.cabinet-nav__badge` numbers, including zero for those three counts on the account sidebar.
- The conversation list is newest activity first. On a wide screen, `/account/messages` and `/me/messages` with no id replace the URL with the first row. On a phone, stay on the list until a row is opened; the thread then fills the screen under the header, and «К списку» returns to the list. Hover tints the row and turns the name brand-colored. Do not steal `?trainer=` while that conversation is still opening. The trainer list includes threads the trainer started.
- Image bubbles use `/messages/files/{id}?preview=1` (a stored JPEG, at most 640px inside) as a 72px thumbnail. The tap target opens the original on the same page and can rotate it by 90 degrees. Documents stay named links. While a send is in flight, a local image uses its object URL in the same frame.
- Client bubbles are turquoise (`is-user`). Trainer bubbles are coral (`is-trainer`). `mine` only places the bubble on the right.
- A participant files one report for the whole conversation from the header flag. The dialog asks for a reason and a comment. `reportMessage` writes `conversation_id`, `reporter_side` (`client` or `trainer`), the Russian reason, and the plain comment, and leaves `message_id` empty. A second report from the same person is a duplicate, not a new row. `notifyStaffAboutReport` mails active admins. Do not put the comment in `app_logs`; log `commentLength` only.
- In the list and the thread header the given name and surname stay on one line. Do not show «Открыта» or «Закрыта» next to the name. A closed thread is explained in the composer. The composer text is 14px.
- The header envelope goes to `/me/messages` for a trainer or club. Staff with a zero personal count go to `/admin/messages`. Everyone else goes to `/account/messages`.
- `MessageEditor` inserts emoji with a text node and an `input` event so the controlled editor keeps the character. Do not rely on `document.execCommand` alone.
- The emoji panel is in the toolbar flow (`display: contents` on `.emoji-picker`), not a popup that the thread can clip.
- `TrainerContactIcons` replaces the «Написать» label on trainer cards, search cards, and favorites. On a trainer profile the same icons sit after reviews under «Как со мной связаться». The phone is a handset and a `tel:` link; the profile row also shows the number. Telegram uses `TelegramIcon` from `src/components/brand-icons.tsx`. Direct opens `/me/messages?trainer={slug}` for a trainer or club and `/account/messages?trainer={slug}` for a client, in a new tab. A guest still lands on login and returns to the client thread; after login a trainer or club is redirected into `/me`.
- `.layout-staff` wraps only `src/routes/admin.tsx`.

## Changing the schema

`npm run db:push` is not safe here: the database enum `otp_purpose` does not match Drizzle. Apply a narrow `ALTER` for message tables. Do not drop `otp_purpose`.

## After a behavior change

Update `docs/TECH_SPEC.md` §4.6 and, if routes changed, `docs/README.md`. Keep this skill and `.cursor/rules/messages.mdc` in sync with the code. UI strings stay Russian.
