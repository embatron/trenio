---
name: trenio-sync-trainers
description: >-
  Copies trainer cards, catalog status, and message marks between the laptop
  database and the live site, and copies every trainer application from the
  live site onto the laptop. Use when the user runs /sync-trainers or asks to
  sync trainers, drafts, message marks, or applications with the server.
---

# Sync trainers

Instagram outreach runs on the laptop, so the laptop database and the live site have to carry the same trainers. The script copies missing cards, newer card text, catalog status, and the message and link marks. A visit is written when `/hi/{code}` is opened on that host. The laptop copies a live visit onto an empty local mark and does not send its own visit to the site. It also copies every `/join/trainer` application from the site onto the laptop. The script does not send an Instagram message and does not send a laptop application back to the site.

## Do

- Run it from the repo root on the laptop:

```bash
./node_modules/.bin/tsx --env-file=.env scripts/sync-trainers.ts
```

- Read `.cursor/skills/trenio-vps/SKILL.md` before any server step. Do not print a password, a database URL, a short-link code, or `SYNC_TOKEN`.
- Report the JSON summary: how many cards moved, how many statuses and marks changed, how many applications were added or updated, and any handle that failed. Do not print an application’s phone, Telegram, or Instagram.
- Exit 2 means the live site does not have this sync yet. Stop. Do not invent a second path that publishes drafts.

## Do not

- Run the script on the server. The server is the other side of the sync.
- Publish a draft. A draft stays a draft. A status that is already published, hidden, or archived is copied onto the draft side.
- Replace a message mark, a link mark, or a visit mark that is already set. An empty message or link mark is filled from the side that has it.
- Copy a visit mark from the laptop to the live site. The visit is written only when `/hi/{code}` is opened on that host. The laptop fills an empty visit from the live site.
- Copy `test-trener`. That card is the laptop fixture. Skip the row whose slug is `test-trener`, including a different Instagram handle on that row, its photos, and its marks, in both directions. The rule is `.cursor/rules/trainer-sync.mdc`.
- Replace the live short link. The laptop adopts that code when its own is empty.
- Print the card text, a phone, an email, a token, or an application.
- Send laptop applications to the site. Applications move only from the site to the laptop. A local application that the site does not have stays on the laptop.

## Rules

- A trainer who exists on only one side is copied to the other, including photos. `test-trener` is the exception and stays on the laptop.
- Card text moves when the text hash differs. The newer `updated_at` wins. The same clock keeps the live card.
- A draft never overwrites a published, hidden, or archived card. Two catalog statuses follow the newer card.
- Message and link marks move on their own, so a mark does not overwrite the card. A visit moves only from the live site to an empty laptop mark.
- An application matches on its channel, contacts, and the second it was submitted. A missing one is inserted with the site’s time. A site decision of done or rejected is copied. A laptop decision stays while the site row is still new. `link_sent_at` fills an empty laptop value and does not clear one the laptop already has. `welcomes.status` of `undeployed` means the live site does not have this list yet; the card sync still stands.
