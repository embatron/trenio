---
name: trenio-trainer-revisions
description: Keeps twelve post-images of each trainer card and shows the staff diff on the admin trainer page. Use when changing trainer profile writes, the admin trainer page, card text, contacts, photos, or sync and import of a card.
---

# Trainer card revisions

A trainer card keeps the last 12 states of its text and fields. Staff read the diff on the trainer page. The rule is `.cursor/rules/trainer-revisions.mdc`.

## Files

- `scripts/apply-trainer-revisions.ts` — table, snapshot function, trigger, one baseline per existing card. `npm run trainers:revisions`.
- `src/db/schema/trainer-revisions.ts` — Drizzle table. No foreign key.
- `src/lib/catalog/trainer-revision.ts` — `stampTrainerRevision`, `revisionChanges`, `listTrainerRevisionViews`.
- `src/lib/admin/trainers.ts` — staff loader adds `history`.
- `src/components/admin-trainer-page.tsx` — «История» tab.

## When a card is written

Call `stampTrainerRevision` on the same transaction as the insert or update.

| Writer | Source |
| --- | --- |
| Admin editor, photos, certificates, unverified publish | `admin` |
| Cabinet, `/join/account` | `cabinet` |
| `/sync-trainers` card copy | `sync` |
| Instagram import upsert | `import` |
| Short link, mailbox or mobile confirmation | `door` |

An unmarked write still stores a snapshot. Its source is `write` and its actor is empty. Do not set the mark on the session. The pool would reuse it.

The trigger skips a write whose watched fields did not change. `updated_at`, `published_at`, and the invite clock do not create a row.

## Diff

Compare the new snapshot with the previous one in TypeScript. HTML bio is shown as plain text. The oldest kept update, once the thirteenth row has been dropped, has no earlier copy: say so, and do not invent the missing text.

## Staff page

`/admin/trainers/$slug`, tab «История». Newest first. Each row shows the time, the actor name or «Система», the source, and the changed fields as «Было» / «Стало». Empty state: «Изменений пока нет.» The loader already calls `assertStaff`. Do not add a client-only check and do not show this tab in `/me`.

## Do not

- Store claim, preview, or edit tokens in the snapshot.
- Put the bio or a phone number in `trainer.revision`.
- Delete revisions by age. The cap is 12 rows per card, not a clock.
- Use `db:push` to create the table.
