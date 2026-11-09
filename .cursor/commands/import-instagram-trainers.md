# Import Instagram trainers

Read public Instagram profiles into Trenio draft trainer records. One link or a bulk list. Facts written in the same message, and a Threads profile when one is attached, are applied to that account. Photos are chosen by the frame, not by the pixel count. The card text is sentences a person can read aloud.

## Project context

- Follow `.cursor/skills/trenio-instagram-trainers/SKILL.md` for the whole run.
- Field rules, card text, and photo decisions are in `.cursor/skills/trenio-instagram-trainers/fields.md`.
- Read the public profile in the `user-playwright` MCP. Do not call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API.
- On a login wall, sign in with the gitignored `.cursor/skills/trenio-instagram-trainers/LOGIN.md`. Do not print the password and do not commit that file.
- Drafts land in `data/instagram-trainers/`. They stay unpublished. The trainer publishes the profile in the cabinet after the magic link.
- After a draft is saved, carry that one account to the production server. That transfer is the default. It does not publish the profile.

## Input

The rest of the user message is the source list, plus anything the user knows about that account. Accept Instagram profile URLs and bare handles. A bare handle becomes `https://www.instagram.com/{handle}/`. Accept a Threads profile URL (`threads.net` or `threads.com`) as a source for the Instagram account it belongs to. Accept prose facts: name, surname, city, sport, phone, and the rest. Copy those facts onto the account. They fill what the profile does not say. For the name, city, phone, email, Telegram, price, and coaching years, a fact the user states replaces a different value on the page.

One Instagram profile: every fact and every Threads link in the message applies to it. Several profiles: a fact or a Threads link applies to the profile URL nearest above it. A sentence that names a handle applies to that handle. Text above the first URL is not copied onto every profile.

Example:

```
/import-instagram-trainers
https://www.instagram.com/antipenko.training/
https://www.threads.net/@antipenko.training
Анна Антипенко, Минск, тренер по пилатесу, взрослые
```

## Do this now

1. Read the skill, `fields.md`, `scripts/extract-profile.fn.js`, and `scripts/extract-post.fn.js`.
2. Normalize every link. Split off the operator note and any Threads profile. Reject Instagram post, reel, and story URLs as the source list. A Threads post URL is only a way to reach that author's profile.
3. For one profile at a time: open it, snapshot, expand the biography, extract the header, contact buttons, and the pinned-post links. Copy the operator note for this handle into the raw file.
4. Save the face photo by the rule in the skill section "Face photo". Among CDN copies of that same picture, keep the largest file the page loaded. Use only the import Chrome profile and the account named there. When the profile picture is a logo or cuts the face off, use a clear portrait from a post instead.
5. Open the highlight titled «Обо мне», «О себе», «About», or «About me» when it exists. Copy each frame's text.
6. When the user attached Threads, open that profile in the same browser. Expand the biography. Read the header and walk the posts from the top, up to 12 stored posts or the bottom of the profile. Copy each post's text. A video is not a photo. Store at most two stills from a post and judge each one gallery or skip, the same way as an Instagram frame. Scroll past videos when the top of the profile is video. Apply the text to the fields and to the card.
7. Open each pinned post, up to three. Read the caption for profile fields: sport, experience, who they teach, address, city, phone, price, email, Telegram, language, and format. Do not copy or retell that caption in «Как меня представить» or «Как проходят мои тренировки». Read the words on each slide. When the picture carries keys about training, how a session goes, or an «обо мне», copy those words into `pinned[].imageText`. Those words fill the fields and may be spoken in the card. Store at most two photos from that post. Choose them by the frame: the trainer is recognizable, the face is not cut off, the action or the room is readable. Skip a larger file when the frame is a blur, a crowd, a collage, or mostly floor. Do not save a text card, logo, or flyer as a gallery photo. A diploma with the word «диплом», «сертификат», or «удостоверение» in the caption is a document, not a gallery photo.
8. Scroll the profile grid and open other `photo` tiles until two or three gallery photos pass that same composition bar, or the grid ends. A `reel` tile stays closed. A video, a reel poster, and a story are not photos, and they are never the face or the gallery, even when the profile has no other frame. Keep scrolling when the top of the page is video. Threads stills from the posts already opened compete for those same slots. One strong frame is enough. Do not treat those posts as pinned, and do not copy their Instagram captions onto the card.
9. Run eleven `sequentialthinking` steps for that trainer. Separate sports they coach from sports they only practice. A sport in a list, or on a pinned photo, is coached when the profile presents the person as a trainer. `йоге` is йога and `пилатесу` is пилатес. Put facts from pinned captions, pinned image text, Threads, and the operator note into fields: sport, coaching experience, audience, address, city, phone, and the rest. A single name, city, phone, email, Telegram, price, or coaching-year value in the note replaces the page. Store years only when the text says they are coaching years. A bare «стаж N лет» stays out of the field and out of the card. Write «Как меня представить» and «Как проходят мои тренировки» as first-person sentences a person can read aloud. Sources are the biography, the about highlight, the pinned image text, Threads, and the note. Leave the training text empty when those never describe a session. A caption that describes a session stays out of that text. Words on the photo that describe a session do not. Copy email and Telegram when the profile, a pin, a pinned photo, Threads, or the note shows them, without confirmation. Copy a mobile from those sources into the phone field. Store that number as `+375 29 123-45-67`. Do not put it in the biography or the card text, and do not confirm it. The note's mobile wins when it states one. Put one to three short place queries in `address`, separated by ` | `. Each one is the street and house number, or the hall name, not the sentence around it. The save script geocodes them and stores the street.
10. Write `resolved`, `operatorNotes`, and `threads` into `data/instagram-trainers/_raw/{handle}.json` and run `save-draft.ts` for that file. Fix a rejection by revising the thought, not by editing the draft.
11. Carry that saved draft into the local database and to the production server. See "Server" below. Leave `status` as `draft`.
12. On a login wall, sign in from `LOGIN.md` in the import Chrome window. Do not print the password. On a checkpoint, stop the batch. Threads uses that same window.
13. Report each profile: name, coached sport, practiced sports, city, the stored street or that the place did not resolve, phone, email, telegram, pinned count, whether pinned image text was read, face side in pixels, gallery count, certificate count, whether the training text was written, whether the note was applied, whether Threads was read, and fields still empty.
14. Close the Playwright page.

## Server

Carry each saved account to production before the report. Do this by default. Do not wait for a second request.

- Leave `status` as `draft`. Do not set `published`, `hidden`, or `archived`. A request to put the account on the server is this draft transfer. It is not a request to open the public page.
- The trainer receives the magic link, opens the cabinet, and publishes the profile there.
- Run `src/db/sync-instagram-trainers.ts` locally with that handle only, so the laptop database gets the same draft. `save-draft.ts` does not write the database.
- Then run `scripts/sync-remote.ts trainer {handle}`. That posts the draft and the photos to `POST /api/sync/trainer`. Exit 0 means the live site stored them and the profile is still a draft.
- Exit 2 means that route is not on the live site yet. Read `.cursor/skills/trenio-vps/SKILL.md`. Copy `data/instagram-trainers/{handle}.json` and `public/trainers/instagram/{handle}*` into the app directory. Run `src/db/sync-instagram-trainers.ts` on the server with that handle only. Rebuild and restart so the photos are served. Do not print secrets. Do not deploy unrelated changes.
- A guest who opens `/trainers/{handle}` does not see the profile.

## Result

- Saved drafts are listed with their file paths. Each one is also on the production server, still unpublished.
- The profile picture is on disk when it shows the person. Gallery frames are static photos where the trainer and the session read clearly. A video, a reel, and a reel poster are not stored. The search scrolls to the bottom of the grid when the posts above are video. A larger file does not win. Pinned captions fill profile fields. They are not copied into the card text. Words on a pinned photo fill fields and may be spoken in the card. The stored address is the street the geocoder matched, not the raw sentence. The operator note and the Threads text fill fields and the spoken card text. Threads stills get the same gallery or skip verdict. Empty fields stay empty when no source states them.
- The public trainer page stays closed until the trainer publishes it from the cabinet.
