---
name: trenio-messages
description: >-
  Implements and changes Trenio.by direct messages (Сообщения): user to one
  published trainer or club profile, composer, emoji, unread counts, delivery
  and read receipts, moderation. Use when editing conversations, the message
  composer, «Написать», inbox, unread badges, or files under src/lib/messages,
  src/components/messages, or the account, trainer-admin, and admin message routes.
---

# Direct messages

Read `.cursor/rules/messages.mdc` first. Product copy and limits are in `docs/TECH_SPEC.md` §4.6. This skill is the edit map.

## Files

| Concern | Location |
| --- | --- |
| Tables | `src/db/schema/messages.ts` |
| Access, send, read cursor, unread SQL | `src/lib/messages/service.ts` |
| Zod and preview | `src/lib/messages/schemas.ts` |
| Server functions | `src/lib/messages/functions.ts` |
| Poll interval | `src/lib/messages/polling.ts` |
| Email and Telegram debounce | `src/lib/messages/notify.ts` |
| HTML allow-list and grapheme length | `src/lib/catalog/review-html.ts` |
| Emoji groups, including vulgar and skin tones | `src/lib/emoji-catalog.ts` |
| Composer, editor, bubbles, live unread | `src/components/messages/` |
| Header count | `MessageCount` in `src/components/site-chrome.tsx` |
| Routes | `src/routes/account.messages*.tsx`, `trainer-admin.messages*.tsx`, `admin.messages.tsx` |

Do not import `src/db/` or `src/auth/` from those client components. Do not hand-edit `src/routeTree.gen.ts`.

## Access

1. Resolve the published profile by slug. Unpublished or missing profiles cannot be messaged.
2. Open or create the one `open` row for `(user_id, trainer_profile_id)`. A second open row hits the partial unique index.
3. `assertConversationAccess` decides read, write, close, reopen, block. Staff may read any thread. Staff write only when they are the initiator or the owner.
4. `sendMessage` is idempotent on `(conversation_id, client_id)` via `ON CONFLICT DO NOTHING`.
5. `consumeRateLimit` still caps sends: 10 per minute and 300 per day. A separate durable check allows one user to message at most 10 distinct trainer profiles per Europe/Minsk calendar day. A repeat to a trainer already messaged that day is allowed. The profile owner's replies are not counted. The 11th trainer is refused with `DAILY_TRAINER_LIMIT_MESSAGE`, and the cabinet shows that text in `CabinetNotice`.

## Send path

1. `sanitizeReviewHtml` before the length check. The same tags as reviews: `b`, `strong`, `i`, `em`, `ul`, `ol`, `li`, `p`, `br`, and safe `a`.
2. `reviewTextLength` counts graphemes. First message from the initiator: `FIRST_MESSAGE_MAX_LENGTH` (1000). Every later message: `MESSAGE_MAX_LENGTH` (4000). Stored HTML: `MESSAGE_HTML_MAX_LENGTH` (12000).
3. Insert and set `last_message_at` in one transaction. Do not hide or delete the conversation. A participant has no such action. The thread is removed for both sides only when an account is deleted.
4. Notify the other party through `scheduleMessageNotification` (2 minute debounce, no message body). Skip when `last_read_at` is under 30 seconds and `last_read_message_id` already covers this id.

## Receipts and unread

- `conversation_reads.last_read_message_id` is a bigint with no foreign key.
- For the sender, the other reader is the profile owner when the viewer is the initiator, and the initiator when the viewer is the owner. No owner means the receipt stays `delivered`.
- `receipt` is `read` when that cursor is greater than or equal to the message id, otherwise `delivered`. The bubble copy is «Прочитано» or «Доставлено». Pending client sends show «Отправка…».
- `unreadSummary` is one SQL: `{ own, inbox, total, ownedSlugs }`. Root `beforeLoad` loads it. `MessagesLive` repeats `unreadCountFn` every `MESSAGE_SCAN_MS` while the tab is visible.
- Opening a thread calls `markConversationRead` for the newest id, then `router.invalidate()` so the header count drops.

## UI

- Account, trainer, and admin nav labels are «Сообщения». Badges are `.cabinet-nav__badge` numbers, including zero for those three counts on the account sidebar.
- The conversation list is newest activity first. `/account/messages` and `/trainer-admin/messages` with no id replace the URL with the first row. Hover tints the row and turns the name brand-colored. Do not steal `?trainer=` while that conversation is still opening.
- In the list and the thread header the given name and surname stay on one line. Do not show «Открыта» or «Закрыта» next to the name. A closed thread is explained in the composer. The composer text is 14px.
- Header icon links to the trainer inbox when the user is a trainer or club and only the inbox is unread. Staff with a zero personal count go to `/admin/messages`. Everyone else goes to `/account/messages`.
- `MessageEditor` inserts emoji with a text node and an `input` event so the controlled editor keeps the character. Do not rely on `document.execCommand` alone.
- The emoji panel is in the toolbar flow (`display: contents` on `.emoji-picker`), not a popup that the thread can clip.
- `TrainerContactIcons` replaces the «Написать» label on trainer cards, search cards, and favorites. On a trainer profile the same icons sit after reviews under «Как со мной связаться». The phone is a handset and a `tel:` link; the profile row also shows the number. Telegram uses `TelegramIcon` from `src/components/brand-icons.tsx`. Direct opens `/account/messages?trainer={slug}` in a new tab.
- `.layout-staff` wraps only `src/routes/admin.tsx`.

## Changing the schema

`npm run db:push` is not safe here: the database enum `otp_purpose` does not match Drizzle. Apply a narrow `ALTER` for message tables. Do not drop `otp_purpose`.

## After a behavior change

Update `docs/TECH_SPEC.md` §4.6 and, if routes changed, `docs/README.md`. Keep this skill and `.cursor/rules/messages.mdc` in sync with the code. UI strings stay Russian.
