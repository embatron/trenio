# Cabinet link

Confirm a trainer mailbox and issue a one-time link into that cabinet.

## Project context

- Follow `.cursor/skills/trenio-cabinet-link/SKILL.md`.
- Arguments are `slug email` pairs, in the written order. Do not invent a mailbox.
- The link is for the operator to send. It is not a profile letter.

## Do this now

1. Read the skill and the pairs in this message.
2. Run `npm run cabinet-link` on the server that serves the public site, from the app directory, with that `.env`.
3. Report each slug, the mailbox, whether the card was already confirmed, and the one URL. Do not print the database URL.

## Result

- Each named card is confirmed on the given mailbox.
- A draft is published. A hidden card is left hidden and reported.
- Each URL opens only that account for 7 days. A preview fetch does not sign in.
