# Sync trainers

Copy trainer cards, catalog status, and message marks between the laptop database and the live site. Outreach is sent only from the laptop, so both sides have to agree before the next batch.

## Project context

- Follow `.cursor/skills/trenio-sync-trainers/SKILL.md` for the whole run.
- The live site is the one in `.cursor/skills/trenio-vps/SKILL.md`. Do not print a password, a database URL, a short-link code, or `SYNC_TOKEN`.

## Do this now

1. Read the skill.
2. From the repo root, run `./node_modules/.bin/tsx --env-file=.env scripts/sync-trainers.ts`.
3. If the result is `undeployed`, stop and say the live site does not have this sync yet.
4. Report pushed cards, pulled cards, status changes, mark changes, unchanged trainers, applications added and updated, and any failed handle. Do not print an application.

## Result

- A trainer that existed on only one side now exists on both. `test-trener` stayed on the laptop.
- The newer card text is on both sides. The same clock kept the live card.
- A draft was not published by the sync. A status that was already published, hidden, or archived was copied onto the draft.
- Empty message and link marks were filled. An empty visit on the laptop was filled from the live site. A visit recorded on the laptop stayed there. Marks that were already set stayed.
- No Instagram message was sent.
- Every application from the site is on the laptop. An application that exists only on the laptop stayed there. A site decision of done or rejected was copied. Phones and names were not printed.
