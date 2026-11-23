---
name: trenio-cabinet-link
description: >-
  Confirms a trainer mailbox, publishes a draft, and issues a one-time link
  that signs that owner into the cabinet. Use when the user runs /cabinet-link
  or asks for a cabinet link for a confirmed trainer.
---

# Cabinet link

Purpose: a trainer whose mailbox is already known gets one link into that account. The profile letter cannot do this after the card has an owner.

## Files

- `scripts/cabinet-link.ts` — the command
- `src/lib/catalog/cabinet-bind.ts` — `claimConfirmedMailbox`
- `src/lib/catalog/cabinet-entry.ts` — issue and open
- `src/routes/hi.$code.tsx` — `?desk=`
- `src/auth/auth-schema.ts` — `auth_cabinet_entries`

## Do

1. Read the slugs and mailboxes written with the command. A slug without a mailbox is not a guess.
2. Run on the site that should open the link. For trenio.by, run the script on the server with that app's `.env`. Do not print `DATABASE_URL`.
3. The script confirms the mailbox, publishes a draft, and prints one URL per card. A hidden or archived card is refused. A mailbox that belongs to another card is refused.
4. Give the operator the URLs. Do not write a URL into `app_logs`, a commit, or a chat log that is not the operator's request.
5. The link lasts 7 days. A real visit is a server redirect into that owner's cabinet, with the session on the same response. A hidden client does not get a session. That refusal is only for `?desk=`. The mail link, the phone link, and `/hi/{code}` alone are unchanged. When the password is still unset, the first cabinet page is the password sheet, then `/me/profile`.

```bash
npm run cabinet-link -- natali.osanka nataly.khlebus@gmail.com
```

## Do not

```bash
# wrong: the profile letter after the card already has an owner
# /hi/{code}?mail= dies with "карточка уже привязана"
```

Do not send the profile letter again. Do not set a password for the trainer. Do not publish a hidden card. Do not reset `elsakov_ivan`'s cabinet link and do not issue a replacement unless the operator asks. A hidden client must not open it.
