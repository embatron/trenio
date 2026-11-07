---
name: trenio-instagram-trainers
description: >-
  Imports public Instagram trainer profiles into Trenio draft records with the
  Playwright MCP and a per-trainer sequential-thinking pass. Applies operator
  notes and an attached Threads profile. Chooses photos by composition, not by
  pixel size, and writes card text a person can read aloud. Each saved draft
  is copied to the production server and stays unpublished. Use when the user
  pastes instagram.com profile links, adds a Threads link or facts about the
  trainer, asks to parse or import trainers from Instagram, or runs
  /import-instagram-trainers, including a bulk list.
---

# Instagram trainer import

Read a public Instagram profile the user supplied. Apply the facts the user wrote in the same message, and read a Threads profile when the user attached one. Then run photo search, open up to three pinned posts, and decide the trainer fields in sequential thinking. The save script checks those decisions against the Instagram page, the Threads text, and the operator note. It does not choose the name. Taxonomy, card text, and photos: [fields.md](fields.md).

This skill governs `data/instagram-trainers/` and `public/trainers/instagram/`. It does not publish a profile. `status` stays `draft`. The trainer publishes it in the cabinet after the magic link.

Every profile gets its own photo search and its own card text. Do not reuse a sentence or a photo decision from the previous trainer. The card text is ordinary speech: complete sentences a person can read aloud.

## Do

- Use `user-playwright` for the page and `user-sequential-thinking` for the decision. Discover a tool with `GetDynamicTools` before calling it.
- Treat the Instagram handle as the slug and the account id. Before opening a profile, look up that handle and that given name plus surname in `data/instagram-trainers/` and in `trainer_profiles`. The same handle is the same card: update it. The same given name and surname on another slug stops the import. Report that slug. A given name without a surname is not matched to other cards.
- Finish one trainer, including all eleven thoughts and the save, before opening the next profile.
- Keep the biography, the about-highlight frames, and the pinned captions verbatim in `sourceBio`, `aboutProfile`, and `pinned[].caption`.
- Write new sentences for «Как меня представить» and «Как проходят мои тренировки» from the biography, the about highlight, the Threads profile, and the operator note. A pinned Instagram caption is not a sentence for those fields. The sentences are first person and readable aloud. They are not a stack of labels.
- Run photo search for this trainer even when the profile has no pins. Keep a frame because the person and the session read clearly. A larger file does not win.
- Apply every fact the operator wrote for this account. A note can fill a field the profile never states. For the name, city, phone, email, Telegram, price, and coaching years, the note replaces the page when it states a different value.
- When the message includes a Threads profile, read the header, the biography, and the posts that still add facts. Apply that text the same way as the biography.
- Save a phone, email, or Telegram link when the profile, Threads, or the note shows it. Do not send a code and do not mark it confirmed.
- Copy a Belarus mobile from the biography, the about highlight, a pinned caption, a `tel:` button, Threads, or the operator note into the phone field. Store that number as `+375 29 123-45-67`. Do not send SMS and do not mark it confirmed. Remove it from the biography, the highlight, and the card text. When the note states a mobile, that number is the one that is stored.

## Do not

- Call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API. The source is the public profile page.
- Ask the user for an Instagram password, or commit one. The import login is the gitignored `.cursor/skills/trenio-instagram-trainers/LOGIN.md`. Read it and sign in when the page is a login wall. Do not print the password.
- Save an `s100`, `s150`, or `s206` thumbnail as a photo, or edit a thumbnail URL (delete `stp`, or replace `s150` with `s1080`).
- Read Instagram from any browser profile except the import profile named below.
- Choose a given name from the handle, from a previous trainer, or from an example in this skill.
- Save a second slug for a person who already has a card. The same given name and surname is that person. Update the existing slug.
- Leave the given name empty when the profile, a pinned caption, Threads, or the operator note writes that name next to the surname.
- Save when two different given names are written for the same surname and the operator note does not pick one.
- Treat the latest posts as pinned when no pin mark is visible. Open at most three pinned posts. Other posts supply gallery photos only, and only frames that pass the composition bar. Their captions are not profile facts.
- Turn a hobby into the coached sport. «Хожу в походы» and «занимаюсь тайским боксом» are not «тренер по походам» or «тренер по тайскому боксу».
- Paste the biography, a caption, or a Threads post into the card text. Add a fact that the profile, Threads, and the operator note do not state.
- Copy a pinned caption into «Как меня представить» or «Как проходят мои тренировки». Read that caption for fields: sport, experience, audience, address, city, phone, price, email, Telegram, language, and format.
- Rank two different pictures by width or height. Skip a clear portrait because another file has more pixels.
- Ignore a fact the operator wrote, or stop a Threads profile after the first line of the biography.
- Write the card as labels, hashtags, a pipe-separated slogan, or a pasted caption.
- Save a text card, logo, or flyer as a gallery photo. Save a diploma as a gallery photo. Save a frame that cuts the face, hides the person in a crowd, or is mostly a blur, when a clearer frame of the same trainer exists.
- Reply, like, or otherwise react to a story. Open the about highlight only to read it.
- Write the draft into `src/routes/trainers.$slug.tsx`. Geocode an address during import.
- Set `status` to `published`. A request to put the account on the server still leaves the row a draft.

Wrong: the header shows only a surname, so the given name is left empty even though a pinned caption states it.
Wrong: two pinned captions use two different given names, and one of them is picked.
Wrong: the pinned caption is pasted or retold in «Как проходят мои тренировки», or a text card from that pin is saved as a gallery photo.
Right: one given name is written in the profile, a pinned caption, the about highlight, Threads, or the operator note, and that exact name is saved. «Я Аня» stays Аня. A note that says «Анна Козлова» is saved even when the profile header has no name, and it replaces a different name the page shows.
Right: the bio says she coaches ОФК and ЛФК, and that she goes hiking. ОФК is the coached sport. Hiking is stored as practiced, not as the headline.
Right: a pinned caption that says the group is for children, the price is 40 BYN, and the hall is on a named street fills audiences, price, and address. It does not become the card paragraph. A pin that shows the coach clearly, face in frame, is kept. A larger blurry frame from the same carousel is skipped.
Right: the biography is `Кикбоксинг. Минск. Дети и взрослые.` The card says `Я тренер по кикбоксингу в Минске. Занимаюсь с детьми и со взрослыми.`

## Flow

```
Import progress:
- [ ] Normalize the URL list, the operator note, and any Threads link. Look up the handle and the name. The same handle is an update. The same person on another slug stops here
- [ ] For each profile: header, contacts, face photo
- [ ] About highlight, when that title exists
- [ ] Threads profile, when the user attached one: header, biography, posts
- [ ] Each pinned post: read the caption into profile fields, then at most 2 photos
- [ ] Two or three more photos from other posts on the grid
- [ ] Photo search by composition: keep or skip every stored image
- [ ] Sequential thinking, thoughts 1–11, for this trainer only
- [ ] Write resolved into the raw file and run save-draft
- [ ] Sync that draft into the local database and the production database, still unpublished
- [ ] Report filled and missing fields
```

### 1. Normalize URLs

Accept one URL or many. Keep `instagram.com/{handle}` profile URLs. Keep a `threads.net` or `threads.com` profile URL as a source for the Instagram account it belongs to, not as a separate trainer. Reject Instagram `/p/`, `/reel/`, and story links. A Threads post URL is opened only long enough to reach that author's profile; the profile is what gets read. Pause about 2 seconds between profiles. Stop the rest of the batch on a checkpoint page.

### Operator note

The user may write facts after the command: given name, surname, city, sport, phone, and anything else they know. Those facts are `operatorNotes` on that account. Copy them verbatim into the raw file. They are a source. Do not drop a fact because the profile never says it.

- One Instagram profile in the message: every fact and every Threads link in the message applies to it.
- Several Instagram profiles: a fact or a Threads link applies to the profile whose URL is the nearest one above it. A sentence that contains the handle applies to that handle wherever it sits. Text above the first URL is not copied onto every profile. Say in the report that this leading text was not applied.
- A single-value field takes the note when the note states one: given name, surname, city, phone, email, Telegram, price, coaching years. The page value stays when the note is silent on that field.
- Sports, formats, audiences, and languages add. A sport the page already states is still classified. A sport only the note states is classified too.
- Do not invent a fact the note does not state. «Минск» as a catalog default is still not written into the card.

### Threads

A Threads profile is read in the same import browser, after the Instagram header and before the pinned posts. Expand the biography. Copy the header, the biography, and the links into `threads`. Then read posts from the top. Open a truncated post and copy the full text. Keep going while a post adds a fact about this person: name, sport, who they teach, city, address, price, experience, contacts, or how a session goes. Stop at 12 posts, or after three posts in a row that add no such fact. Do not scroll the whole account.

Store `threads.url`, `threads.headerText`, `threads.bio`, and `threads.posts[]` with `url` and `text`. Contacts found there fill the same fields as Instagram contacts. A Threads post may supply a quote for the card text. An Instagram pinned caption still may not.

Photos from the posts you opened join the same composition pass. At most two images stored per Threads post. They compete with Instagram frames for the two or three gallery slots. Keep a Threads frame when it shows the trainer more clearly than a weaker Instagram frame, or when Instagram has no usable frame. Do not add one only to increase the count.

On a Threads login wall, use the same import Chrome profile and `LOGIN.md`. Do not print the password. A checkpoint stops the batch.

### 2. Read the profile

`browser_navigate`, then `browser_snapshot`.

- Cookie dialog: reject optional cookies, or allow all if that is the only choice. Do not click Follow, Message, or Log in.
- Login wall: read `.cursor/skills/trenio-instagram-trainers/LOGIN.md` and sign in. Do not print the password. If that login fails, stop and say so.
- Checkpoint: stop the batch.
- Unavailable profile: record the failure and continue.

The extract clicks `more` / `ещё` when the biography is folded. Wait and evaluate a second time, then keep that `headerText`. Also read `contacts` (`mailto:`, `tel:`, `t.me`) and `highlightLinks`.

Pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-profile.fn.js` as `function` to `browser_evaluate`. `pinnedPosts` lists only tiles with a pin mark, at most three. If the snapshot shows a pin and `pinnedPosts` is empty, evaluate once more. If it is still empty, continue with no pinned posts. Other grid posts are opened later, and only to choose two or three gallery photos.

### About highlight

If a highlight title is `Обо мне`, `О себе`, `About`, or `About me`, open that highlight only. Confirm `View story` when Instagram asks. Do not reply and do not like. Pause on each frame. Copy the sticker text on that frame into `aboutFrames`, one string per frame, in order. Story text is often drawn on the image, so read the frame image. Skip a frame that has no words. Stop when the first frame repeats or the highlight title changes. Close it before the next profile.

### Contacts

Phone, email, and Telegram come from the biography, the about frames, the contact buttons, Threads, the operator note, and `t.me` / `mailto:` / `tel:` links. Put each value into the matching profile field. Do not create an account, do not send SMS or email, and do not mark the contact confirmed. Leave the field empty when none of those sources show it. A Threads or YouTube link is not Telegram.

A Belarus mobile in the biography, the about highlight, a pinned caption, a `tel:` button, Threads, or the operator note is copied into the phone field. `save-draft.ts` stores that same number as `+375 29 123-45-67` and then deletes it from `sourceBio`, `sourceAbout`, `bio`, and `about`. `+375(29)123-45-67`, `+375291234567`, and `80291234567` are one mobile and become that spaced form. The script does not send SMS and does not mark the number confirmed. The public profile hides it until the owner confirms it. Leave the field empty when no source shows a mobile. When the note states one mobile, store that number even if the page prints a different one.

### Face photo

Use only this browser and this account:

- Chrome user data dir: `/home/embatron/.cache/trenio-instagram-login`
- Instagram account signed in there: `trenioby`. The password is in the gitignored `LOGIN.md` next to this skill.

Do not use the everyday Chrome profile and do not copy its cookies. On a login wall, sign in with that note. Do not print the password and do not commit `LOGIN.md`.

The face photo is the profile-picture image whose alt is `{handle}'s profile picture`. Click that picture, then let the page load. `extract-profile.fn.js` reads the image id from the `src` filename and downloads every URL the page itself already loaded for that id. It keeps the file with the greatest width and height. The URL is not rewritten: do not delete `stp`, and do not replace `s150` with `s1080`. The CDN answers `URL signature mismatch` or returns the thumbnail.

`s100`, `s150`, and `s206` are thumbnails. Save one only when it is the largest file the page loaded for that same picture and no saved face of at least 400px is already on disk. Among CDN copies of one profile picture, keep the largest file the page loaded: that is the same crop, not a different composition. A new file of at least 400px on both sides replaces a saved face, even when it has fewer pixels. A file below 400px does not replace a saved face.

The profile picture stays the face when it shows this person, including a back view or a flex. When it is a logo, a text card, or a crop that cuts the face off, and a judged photo is a clear portrait, put that portrait's bytes in `avatarBase64` and do not use the logo as the face. The gallery does not repeat that same file. When no frame clears the composition bar, still save the profile picture and the still photos the profile has. An empty gallery is only for a profile whose posts are videos or stories. Do not save a video, a reel still that is not a real photo file, or a story frame as a gallery photo.

`save-draft.ts` stores that file as `public/trainers/instagram/{handle}.jpg` and writes the sized files beside it (`s128`, `c320`, `c640`, `w960`). The master JPEG is sent through TinyPNG when `TINIFY_API_KEY` is set. The catalog keeps using `{handle}.jpg`.

### 3. Pinned posts and photo search

Photo search is part of every trainer, not a separate command.

For each URL in `pinnedPosts`, open it, take a screenshot, and pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-post.fn.js` to `browser_evaluate`. Store `url`, `ogDescription`, `heading`, `visibleText`, and `photos`. The caption is the verbatim post text inside that source, not a summary. Read it for profile fields. Do not retell it in the card text.

`photos` holds at most two images from that post. The extractor downloads a file the page already loaded. An `stp` of `s100`, `s150`, or `s206` is skipped. A display URL such as `stp=dst-jpg_e35` is kept when both sides are at least 400px. It does not rewrite a thumbnail URL. 400px is the floor that rejects a thumbnail. It is not a reason to prefer one picture over another. If `carouselNext` is true, click the control named Next, Далее, Вперёд, or Следующий, up to four times. Screenshot each slide. Extract again and merge by file stem. Do not click Like. From the slides you opened, store the two images you will judge. Choose those two by the frame, not by the pixel count. Do not store a fifth slide.

Look at the grid tile before opening a post for a gallery photo. Open a tile that shows a person or a session. Skip a tile that is a text card, a collage, or a flyer. Still open a pinned post to read the caption, even when the tile is a text card.

Judge every stored image, including Threads frames, from the screenshot:

- `gallery` — this trainer, a session, the gym, or the class, and the frame reads at a glance. Saved after the face as `{handle}-g2.jpg`, `{handle}-g3.jpg`, and so on. List the strongest frame first in `photoKeeps`. The script saves gallery files in that order.
- `certificate` — a document, and the caption contains «диплом», «сертификат», or «удостоверение». Saved as `{handle}-d1.jpg` with a verbatim caption. Not also a gallery photo.
- skip — `text`, `logo`, `flyer`, `duplicate` (the same file as the face), `not-trainer`, `crop` (face cut at the chin or eyes, or the frame is mostly floor, ceiling, or a wall), `clutter` (collage, chat screenshot, text burned over the photo), `crowd` (this trainer cannot be picked out), `back` (only the back of the head when a clearer frame exists), or `blur` (motion blur or a dark frame where the person is not readable).

Prefer, when several frames clear the floor: a portrait or three-quarter with the face unobstructed; then the trainer coaching or training, body in frame, the action understandable; then the gym only when the trainer is in it. A still moment beats a motion blur. An empty hall loses to a session. One strong frame is enough. Do not pad the gallery with a weaker frame to reach three when a stronger frame is already kept. When every still photo fails that bar, keep the stills the profile has anyway: a back view, a crop, or a crowd is the gallery rather than no photo. Skip a video and a story. A reel is a video. A carousel of photos is not.

A profile with no pins still finishes photo search. After the pins, open other posts on the grid until two or three gallery photos are chosen, or the grid has no such photo. Those posts are `extraPosts`, at most four, and their captions are not quotes for the card. A text card, logo, or flyer is skipped.

Return to the profile only after that post's caption and photos are stored. Then go back to the profile grid only to reach the next pin.

### 4. Sequential thinking

Call `sequentialthinking` in `user-sequential-thinking` eleven times for this trainer. `totalThoughts` is 11. Do not start the next trainer inside this chain.

1. Quote the profile display line and bio. Quote the operator note verbatim. Do not decide the name yet.
2. Quote the Threads header, biography, and each post you stored. If the message has no Threads link, say so. Do not decide the name yet.
3. Quote each about frame and each pinned caption, up to three pins. State how many pins were marked and how many photos were stored. Do not quote unpinned posts.
4. List every given-name candidate with its quote, including the note and Threads. One name the operator note states becomes `firstName`, even when the page writes another. No note and one name written for this account → that name. None → empty. Two conflicting page names and no note → stop, do not save this profile.
5. Family name by the same rule. The note wins when it states a surname.
6. Read the quotes again. If a given name stands next to the surname and `firstName` is empty or different, revise thought 4 (`isRevision: true`, `revisesThought: 4`). The operator note wins over the page.
7. For every taxonomy phrase in the biography, the about frames, the pins, Threads, and the note, decide `coached` or `practiced` from the clause that contains it. Coached: the same clause says they teach or lead it (`тренер`, `тренирую`, `инструктор`, `занятия`). Practiced: the clause says they do it themselves (`занимаюсь`, `хожу в`, `увлекаюсь`, `для себя`). A longer hobby alias does not become the headline. `primarySportSlug` is the coached sport the profile leads with. The note's coached sport leads when the page names none. The same quotes fill fields, not the card: city, `address` (the street or hall as printed; do not geocode it), price, phone, email, telegram, languages, coaching experience only (`тренерский стаж N лет`, `стаж работы тренером`, `опыт тренерской работы`, `тренирую N лет`; a bare `стаж N лет` stays out of the field and out of the card), formats (`персональные` / `групповые`), and audiences (`взрослые`, `дети`, `подростки`). A fact that appears only in a pin, in Threads, or in the note still fills the field. For name, city, phone, email, Telegram, price, and coaching years, one value in the note replaces the page. `phone` is the number as printed. The save script copies it into the phone field, stores the spaced form, and removes it from the description. It does not confirm the number.
8. Photo search. For every stored image, say gallery, certificate, or skip, and why the frame won or lost. Say what the frame shows. Do not cite pixel size as the reason, except to reject a file below 400px. The face photo is already kept and is not in this list. List gallery keeps with the clearest frame first.
9. Write `presentation` («Как меня представить») and `presentationQuotes`. First person, one to four sentences a person can read aloud. Ordinary words. One fact each. No emoji, hashtags, labels joined by a line or a pipe, or a call to write in direct. Quotes come from the biography, the about highlight, Threads, or the operator note, not from an Instagram pin. Name the city and the coached sport when those words are already in one of those sources. A city that appears only in a pin stays in the field and stays out of this text.
10. Write `training` («Как проходят мои тренировки») and `trainingQuotes` only when the biography, the about highlight, Threads, or the operator note describes a session. A pin that describes a session fills fields and leaves this text empty. Do not paste or retell a caption. A blank line separates paragraphs. The same spoken-sentence rule as thought 9.
11. Write the `resolved` object. Set `nextThoughtNeeded` to false only on this thought. `save-draft.ts` then sets `gender` to `male` or `female` from the given name. Do not put gender in `resolved` and do not show it on the public page or the trainer profile. Staff see it on the admin trainer card. The claim greeting uses it only to choose «был» or «была».

`resolved` shape:

```json
{
  "firstName": "",
  "lastName": "",
  "nameQuotes": [],
  "sourceBio": "",
  "aboutProfile": [],
  "presentation": "",
  "presentationQuotes": [],
  "training": "",
  "trainingQuotes": [],
  "sportQuotes": [],
  "coachedSports": [{ "slug": "ofk", "quote": "" }],
  "practicedSports": [{ "slug": "pohod", "quote": "" }],
  "unrelatedSports": [],
  "primarySportSlug": "",
  "city": "",
  "address": "",
  "priceFrom": null,
  "phone": "",
  "email": "",
  "telegram": "",
  "languages": [],
  "experienceYears": null,
  "formats": [],
  "audiences": [],
  "photoKeeps": [{ "postUrl": "", "index": 0, "role": "gallery" }],
  "photoSkips": [{ "postUrl": "", "index": 1, "reason": "crop" }]
}
```

`nameQuotes` are verbatim slices that contain the saved name parts. A slice may come from the profile, a pin, Threads, or the operator note. `sportQuotes` are verbatim slices for every sport phrase. Each phrase is either coached or practiced. `aboutProfile` copies `aboutFrames`. Email and Telegram are copied as printed. They are not confirmed. `phone` is the mobile from the profile, a pin, Threads, or the note. The draft stores that number as `+375 29 123-45-67`, unconfirmed, and removes it from the source and the card text. `address` is the street or hall line from the biography, the about highlight, a pinned caption, Threads, or the note. The import stores that line and does not geocode it. `presentationQuotes` and `trainingQuotes` are slices of the biography, the about highlight, Threads, or the operator note. They are not slices of an Instagram pin. The raw file also stores `operatorNotes` and `threads`. Do not put those objects inside `resolved`.

Do not set `bio` or `about` inside `resolved`. The script writes those from `presentation` and `training`. `audiences` stays empty when the profile does not name who they teach. Order, when it does: `adult`, `kid`, `teen`. A certificate keep also has `caption`.

### 5. Save

Write `data/instagram-trainers/_raw/{handle}.json` with the extract, `operatorNotes`, `threads`, the `pinned` array (caption plus judged photos), and `resolved`. From the repo root:

```bash
./node_modules/.bin/tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts data/instagram-trainers/_raw/{handle}.json
```

If the script rejects the file, revise the thought it names and run it again. Do not edit the draft JSON by hand. The script refuses a given name that is not in the quotes, a given name that contradicts the name written next to the surname unless the operator note states the saved name, a pasted caption or Threads post, a card sentence that adds a city, number, or sport the sources do not state, and a city or price that the text does not state. A single city, phone, email, Telegram, price, or coaching-year value in the note replaces the page. When no source names a settlement and no street is named, leave `city` empty: the script stores Минск. Do not write that default into the card text. The profile crumb is then «Тренеры в Минске».

`save-draft.ts` keeps `status: draft` unless the previous draft file was already `published`, `hidden`, or `archived`. Do not flip a new import to `published` so the sync will show it.

### 6. Server

After the draft is accepted, write it into the local database and carry that same account to production. This is the default. Do not wait for another request.

`save-draft.ts` writes the JSON and the photo files only. The database row appears only where the draft is applied. Apply it locally first:

```bash
./node_modules/.bin/tsx --env-file=.env src/db/sync-instagram-trainers.ts {handle}
```

Then send that same draft, including the photos, to the live site:

```bash
./node_modules/.bin/tsx --env-file=.env scripts/sync-remote.ts trainer {handle}
```

Exit 0 means the live database and the photo files are updated. The profile stays `draft`. Do not rebuild for that account.

Exit 2 means the live site does not have `/api/sync/trainer` yet. Read `.cursor/skills/trenio-vps/SKILL.md`, copy `data/instagram-trainers/{handle}.json` and `public/trainers/instagram/{handle}*` into the app directory, and run `src/db/sync-instagram-trainers.ts {handle}` there. Do not run it without a handle. Rebuild and restart so those photo files are served. Do not print secrets. Do not deploy unrelated changes.

The row stays `draft`. Do not set `published`. A guest does not see `/trainers/{handle}`. The trainer opens the magic link, enters the cabinet, and publishes the profile there. A request to put the account on the server means this transfer.

### 7. Report

One line per link: handle, full name, primary sport, practiced sports, city, phone, email, telegram, pinned count, face side in pixels, gallery count, certificate count, whether the training text was written, whether an operator note was applied, whether Threads was read, and fields still empty. Drafts stay unpublished. Say that the draft is in the local database and on the server. Call `browser_close` when the batch ends.

## Bulk

`/import-instagram-trainers` uses this flow for every link. A rejected profile does not discard drafts already saved.
