---
name: trenio-instagram-trainers
description: >-
  Imports public Instagram trainer profiles into Trenio draft records with the
  Playwright MCP and a per-trainer sequential-thinking pass. For every trainer
  it runs photo search (face plus pinned photos) and writes readable card text.
  Use when the user pastes instagram.com profile links, asks to parse or import
  trainers from Instagram, or runs /import-instagram-trainers, including a bulk list.
---

# Instagram trainer import

Read a public Instagram profile the user supplied, run photo search, open up to three pinned posts, then decide the trainer fields in sequential thinking. The save script checks those decisions against the page text. It does not choose the name. Taxonomy, card text, and photos: [fields.md](fields.md).

This skill governs `data/instagram-trainers/` and `public/trainers/instagram/`. It does not publish catalog routes.

Every profile gets its own photo search and its own card text. Do not reuse a sentence or a photo decision from the previous trainer.

## Do

- Use `user-playwright` for the page and `user-sequential-thinking` for the decision. Discover a tool with `GetDynamicTools` before calling it.
- Finish one trainer, including all ten thoughts and the save, before opening the next profile.
- Keep the biography, the about-highlight frames, and the pinned captions verbatim in `sourceBio`, `aboutProfile`, and `pinned[].caption`.
- Write new sentences for «Как меня представить» and «Как проходят мои тренировки». Rules are in fields.md under Card text.
- Run photo search for this trainer even when the profile has no pins.
- Save a phone, email, or Telegram link when the profile shows it. Do not send a code and do not mark it confirmed.
- Copy a Belarus mobile from the biography, the about highlight, a pinned caption, or a `tel:` button into the phone field. Store that number as `+375 29 123-45-67`. Do not send SMS and do not mark it confirmed. Remove it from the biography, the highlight, and the card text.

## Do not

- Call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API. The source is the public profile page.
- Ask for, type, or store an Instagram password.
- Save an `s100`, `s150`, or `s206` thumbnail as a photo, or edit a thumbnail URL (delete `stp`, or replace `s150` with `s1080`).
- Read Instagram from any browser profile except the import profile named below.
- Choose a given name from the handle, from a previous trainer, or from an example in this skill.
- Leave the given name empty when the profile or a pinned caption writes that name next to the surname.
- Save when two different given names are written for the same surname.
- Treat the latest posts as pinned when no pin mark is visible. Open at most three pinned posts.
- Turn a hobby into the coached sport. «Хожу в походы» and «занимаюсь тайским боксом» are not «тренер по походам» or «тренер по тайскому боксу».
- Paste the biography or a caption into the card text, or add a fact the source does not state.
- Save a text card, logo, or flyer as a gallery photo. Save a diploma as a gallery photo.
- Reply, like, or otherwise react to a story. Open the about highlight only to read it.
- Write the draft into `src/routes/trainers.$slug.tsx`. Geocode an address during import.

Wrong: the header shows only a surname, so the given name is left empty even though a pinned caption states it.
Wrong: two pinned captions use two different given names, and one of them is picked.
Wrong: the pinned caption is pasted into «Как проходят мои тренировки», or a text card from that pin is saved as a gallery photo.
Right: one given name is written in the profile, a pinned caption, or the about highlight, and that exact name is saved. «Я Аня» stays Аня.
Right: the bio says she coaches ОФК and ЛФК, and that she goes hiking. ОФК is the coached sport. Hiking is stored as practiced, not as the headline.
Right: a caption that says the session is a warm-up and then sparring becomes two short sentences. A pin that shows the coach in the gym is saved after the face photo.

## Flow

```
Import progress:
- [ ] Normalize the URL list
- [ ] For each profile: header, contacts, face photo
- [ ] About highlight, when that title exists
- [ ] Each pinned post: caption, carousel, screenshot, at most 2 photos
- [ ] Photo search: keep or skip every stored pinned image
- [ ] Sequential thinking, thoughts 1–10, for this trainer only
- [ ] Write resolved into the raw file and run save-draft
- [ ] Report filled and missing fields
```

### 1. Normalize URLs

Accept one URL or many. Keep only `instagram.com/{handle}` profile URLs. Reject `/p/`, `/reel/`, and story links. Pause about 2 seconds between profiles. Stop the rest of the batch on a checkpoint page.

### 2. Read the profile

`browser_navigate`, then `browser_snapshot`.

- Cookie dialog: reject optional cookies, or allow all if that is the only choice. Do not click Follow, Message, or Log in.
- Login wall and no profile header: stop this profile and ask the user to sign in once in the Playwright window. Do not type credentials.
- Checkpoint: stop the batch.
- Unavailable profile: record the failure and continue.

The extract clicks `more` / `ещё` when the biography is folded. Wait and evaluate a second time, then keep that `headerText`. Also read `contacts` (`mailto:`, `tel:`, `t.me`) and `highlightLinks`.

Pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-profile.fn.js` as `function` to `browser_evaluate`. `pinnedPosts` lists only tiles with a pin mark, at most three. If the snapshot shows a pin and `pinnedPosts` is empty, evaluate once more. If it is still empty, continue with no pinned posts. Do not open unpinned posts.

### About highlight

If a highlight title is `Обо мне`, `О себе`, `About`, or `About me`, open that highlight only. Confirm `View story` when Instagram asks. Do not reply and do not like. Pause on each frame. Copy the sticker text on that frame into `aboutFrames`, one string per frame, in order. Story text is often drawn on the image, so read the frame image. Skip a frame that has no words. Stop when the first frame repeats or the highlight title changes. Close it before the next profile.

### Contacts

Phone, email, and Telegram come from the biography, the about frames, the contact buttons, and `t.me` / `mailto:` / `tel:` links. Put each value into the matching profile field. Do not create an account, do not send SMS or email, and do not mark the contact confirmed. Leave the field empty when the profile does not show it. A Threads or YouTube link is not Telegram.

A Belarus mobile in the biography, the about highlight, a pinned caption, or a `tel:` button is copied into the phone field. `save-draft.ts` stores that same number as `+375 29 123-45-67` and then deletes it from `sourceBio`, `sourceAbout`, `bio`, and `about`. `+375(29)123-45-67`, `+375291234567`, and `80291234567` are one mobile and become that spaced form. The script does not send SMS and does not mark the number confirmed. The public profile hides it until the owner confirms it. Leave the field empty when the profile shows no mobile. Do not replace the printed number with a different one.

### Face photo

Use only this browser and this account:

- Chrome user data dir: `/home/embatron/.cache/trenio-instagram-login`
- Instagram account signed in there: `embratron.eth`

Do not use the everyday Chrome profile and do not copy its cookies. Do not type or store the password. If that window shows a login wall, stop and ask the user to sign in once there.

The face photo is the profile-picture image whose alt is `{handle}'s profile picture`. `extract-profile.fn.js` reads that image id from the `src` filename, then keeps URLs the page itself already loaded whose path contains that id and which have no `stp` parameter. It downloads the largest of those files. Both sides must be at least 400px. A thumbnail URL is not rewritten.

`save-draft.ts` stores that file as `public/trainers/instagram/{handle}.jpg` and writes the sized files beside it (`s128`, `c320`, `c640`, `w960`). The master JPEG is sent through TinyPNG when `TINIFY_API_KEY` is set. The catalog keeps using `{handle}.jpg`. A later import that has no source of at least 400px leaves the saved file in place.

Do not save `s100`, `s150`, or `s206`. Do not delete `stp` from a thumbnail URL and do not replace `s150` with `s1080`. The CDN answers `URL signature mismatch` or returns the thumbnail.

### 3. Pinned posts and photo search

Photo search is part of every trainer, not a separate command.

For each URL in `pinnedPosts`, open it, take a screenshot, and pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-post.fn.js` to `browser_evaluate`. Store `url`, `ogDescription`, `heading`, `visibleText`, and `photos`. The caption is the verbatim post text inside that source, not a summary.

`photos` holds at most two images from that post. The extractor downloads a file the page already loaded, with no `stp` parameter, both sides at least 400px. It does not rewrite a thumbnail URL. If `carouselNext` is true, click the control named Next, Далее, Вперёд, or Следующий, up to four times. Screenshot each slide. Extract again and merge by file stem. Do not click Like. From the slides you opened, store the two images you will judge. Prefer a slide that shows the trainer or the session over a text card. Do not store a fifth slide.

Judge every image left in `pinned.photos`:

- `gallery` — this trainer, a session, the gym, or the class. Saved after the face as `{handle}-g2.jpg`, `{handle}-g3.jpg`, and so on.
- `certificate` — a document, and the caption contains «диплом», «сертификат», or «удостоверение». Saved as `{handle}-d1.jpg` with a verbatim caption. Not also a gallery photo.
- skip — `text`, `logo`, `flyer`, `duplicate` (the same file as the face), or `not-trainer`.

A profile with no pins still finishes photo search: the face is the only photo, and `photoKeeps` is empty. Do not open unpinned posts to hunt for more pictures.

Return to the profile only after that post's caption and photos are stored. Then go back to the profile grid only to reach the next pin.

### 4. Sequential thinking

Call `sequentialthinking` in `user-sequential-thinking` ten times for this trainer. `totalThoughts` is 10. Do not start the next trainer inside this chain.

1. Quote the profile display line and bio. Do not decide the name yet.
2. Quote each about frame and each pinned caption, up to three pins. State how many pins were marked and how many photos were stored. Do not quote unpinned posts.
3. List every given-name candidate with its quote. One candidate written for this account becomes `firstName`. None → empty. Two conflicting names → stop, do not save this profile.
4. Family name by the same rule.
5. Read the quotes again. If a given name stands next to the surname and `firstName` is empty or different, revise thought 3 (`isRevision: true`, `revisesThought: 3`).
6. For every taxonomy phrase in the biography, the about frames, and the pins, decide `coached` or `practiced` from the clause that contains it. Coached: the same clause says they teach or lead it (`тренер`, `тренирую`, `инструктор`, `занятия`). Practiced: the clause says they do it themselves (`занимаюсь`, `хожу в`, `увлекаюсь`, `для себя`). A longer hobby alias does not become the headline. `primarySportSlug` is the coached sport the profile leads with. Also city, price, phone, email, telegram, languages, experience (`стаж N лет` or `более N лет`), formats (`персональные` / `групповые`), and audiences (`взрослые`, `дети`, `подростки`). `phone` is the number as printed. The save script copies it into the phone field, stores the spaced form, and removes it from the description. It does not confirm the number.
7. Photo search. For every stored pinned image, say gallery, certificate, or skip, and why. The face photo is already kept and is not in this list.
8. Write `presentation` («Как меня представить») and `presentationQuotes`. First person, one to four sentences, the saved city, the coached sport. No emoji and no contacts.
9. Write `training` («Как проходят мои тренировки») and `trainingQuotes`. Empty when the source never describes a session, a place, or a format. Do not paste a caption. A blank line separates paragraphs.
10. Write the `resolved` object. Set `nextThoughtNeeded` to false only on this thought. `save-draft.ts` then sets `gender` to `male` or `female` from the given name. Do not put gender in `resolved` and do not show it on the public page or the trainer profile. Staff see it on the admin trainer card. The claim greeting uses it only to choose «был» or «была».

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
  "priceFrom": null,
  "phone": "",
  "email": "",
  "telegram": "",
  "languages": [],
  "experienceYears": null,
  "formats": [],
  "audiences": [],
  "photoKeeps": [{ "postUrl": "", "index": 0, "role": "gallery" }],
  "photoSkips": [{ "postUrl": "", "index": 1, "reason": "text" }]
}
```

`nameQuotes` are verbatim slices that contain the saved name parts. `sportQuotes` are verbatim slices for every sport phrase. Each phrase is either coached or practiced. `aboutProfile` copies `aboutFrames`. Email and Telegram are copied as printed. They are not confirmed. `phone` is the mobile printed in the profile. The draft stores that number as `+375 29 123-45-67`, unconfirmed, and removes it from the source and the card text.

Do not set `bio` or `about` inside `resolved`. The script writes those from `presentation` and `training`. `audiences` stays empty when the profile does not name who they teach. Order, when it does: `adult`, `kid`, `teen`. A certificate keep also has `caption`.

### 5. Save

Write `data/instagram-trainers/_raw/{handle}.json` with the extract, the `pinned` array (caption plus judged photos), and `resolved`. From the repo root:

```bash
./node_modules/.bin/tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts data/instagram-trainers/_raw/{handle}.json
```

If the script rejects the file, revise the thought it names and run it again. Do not edit the draft JSON by hand. The script refuses a given name that is not in the quotes, a given name that contradicts the name written next to the surname, a pasted caption, a card sentence that adds a city, number, or sport, and a city or price that the text does not state.

### 6. Report

One line per link: handle, full name, primary sport, practiced sports, city, phone, email, telegram, pinned count, face side in pixels, gallery count, certificate count, whether the training text was written, and fields still empty. Drafts stay unpublished. Call `browser_close` when the batch ends.

## Bulk

`/import-instagram-trainers` uses this flow for every link. A rejected profile does not discard drafts already saved.
