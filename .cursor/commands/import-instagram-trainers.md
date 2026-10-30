# Import Instagram trainers

Read public Instagram profiles into Trenio draft trainer records. One link or a bulk list. Each trainer gets photo search and readable card text.

## Project context

- Follow `.cursor/skills/trenio-instagram-trainers/SKILL.md` for the whole run.
- Field rules, card text, and photo decisions are in `.cursor/skills/trenio-instagram-trainers/fields.md`.
- Read the public profile in the `user-playwright` MCP. Do not call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API.
- Do not ask for, type, or store an Instagram password.
- Drafts land in `data/instagram-trainers/`. They stay unpublished.

## Input

The rest of the user message is the source list. Accept profile URLs and bare handles. A bare handle becomes `https://www.instagram.com/{handle}/`.

Example:

```
/import-instagram-trainers
https://www.instagram.com/antipenko.training/
https://www.instagram.com/another.coach/
```

## Do this now

1. Read the skill, `fields.md`, `scripts/extract-profile.fn.js`, and `scripts/extract-post.fn.js`.
2. Normalize every link. Reject post, reel, and story URLs as the source list.
3. For one profile at a time: open it, snapshot, expand the biography, extract the header, contact buttons, and the pinned-post links.
4. Save the face photo by the rule in the skill section "Face photo". Use only the import Chrome profile and the account named there.
5. Open the highlight titled «Обо мне», «О себе», «About», or «About me» when it exists. Copy each frame's text.
6. Run photo search. Open each pinned post, up to three. Copy its caption. Screenshot the post and each carousel slide you consider. Store at most two photos from that post. Do not open unpinned posts. Keep a photo of the trainer, the session, or the gym. Skip a text card, logo, or flyer. A diploma with the word «диплом», «сертификат», or «удостоверение» in the caption is a document, not a gallery photo.
7. Run ten `sequentialthinking` steps for that trainer. Separate sports they coach from sports they only practice. Write «Как меня представить» and «Как проходят мои тренировки» as short first-person sentences a person can read. Use only facts from the biography, the about highlight, and the pinned captions. Leave the training text empty when the source never describes a session. Copy email and Telegram when the profile shows them, without confirmation. Copy a mobile from the biography, the about highlight, a pinned caption, or a `tel:` button into the phone field. Store that number as `+375 29 123-45-67`. Do not put it in the biography or the card text, do not replace it with another number, and do not confirm it.
8. Write `resolved` into `data/instagram-trainers/_raw/{handle}.json` and run `save-draft.ts` for that file. Fix a rejection by revising the thought, not by editing the draft.
9. On a login wall, stop and ask the user to sign in once in the import Chrome window from the skill. Do not type the password. On a checkpoint, stop the batch.
10. Report each profile: name, coached sport, practiced sports, city, phone, email, telegram, pinned count, face side in pixels, gallery count, certificate count, whether the training text was written, and fields still empty.
11. Close the Playwright page.

## Result

- Saved drafts are listed with their file paths.
- The face photo and any kept pinned photos are on disk. The two card texts are written for reading. Empty fields stay empty.
- The public trainer pages are unchanged until a later catalog import.
