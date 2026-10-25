---
name: trenio-instagram-trainers
description: >-
  Imports public Instagram trainer profiles into Trenio draft records with the
  Playwright MCP and a per-trainer sequential-thinking pass. Use when the user
  pastes instagram.com profile links, asks to parse or import trainers from
  Instagram, or runs /import-instagram-trainers, including a bulk list of links.
---

# Instagram trainer import

Read a public Instagram profile the user supplied, open up to three pinned posts, then decide the trainer fields in sequential thinking. The save script checks those decisions against the page text. It does not choose the name. Taxonomy and fields: [fields.md](fields.md).

This skill governs `data/instagram-trainers/` and `public/trainers/instagram/`. It does not publish catalog routes.

## Do

- Use `user-playwright` for the page and `user-sequential-thinking` for the decision. Discover a tool with `GetDynamicTools` before calling it.
- Finish one trainer, including all eight thoughts and the save, before opening the next profile.
- Copy description text from the profile bio, the «Обо мне» highlight, and the pinned captions. Do not paraphrase it.
- Save a phone, email, or Telegram link when the profile shows it. Do not send a code and do not mark it confirmed.
- Put a phone only in the phone field. Remove it from the biography and from the about text. Store `+375 33 637-62-68` — the same value every trainer card uses.

## Do not

- Call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API. The source is the public profile page.
- Ask for, type, or store an Instagram password.
- Save an `s100`, `s150`, or `s206` thumbnail as the face photo, or edit a thumbnail URL (delete `stp`, or replace `s150` with `s1080`).
- Read Instagram from any browser profile except the import profile named below.
- Choose a given name from the handle, from a previous trainer, or from an example in this skill.
- Leave the given name empty when the profile or a pinned caption writes that name next to the surname.
- Save when two different given names are written for the same surname.
- Treat the latest posts as pinned when no pin mark is visible. Open at most three pinned posts.
- Turn a hobby into the coached sport. «Хожу в походы» and «занимаюсь тайским боксом» are not «тренер по походам» or «тренер по тайскому боксу».
- Reply, like, or otherwise react to a story. Open the about highlight only to read it.
- Write the draft into `src/routes/trainers.$slug.tsx`.

Wrong: the header shows only a surname, so the given name is left empty even though a pinned caption states it.
Wrong: two pinned captions use two different given names, and one of them is picked.
Right: one given name is written in the profile, a pinned caption, or the about highlight, and that exact name is saved. «Я Аня» stays Аня.
Right: the bio says she coaches ОФК and ЛФК, and that she goes hiking. ОФК is the coached sport. Hiking is stored as practiced, not as the headline.

## Flow

```
Import progress:
- [ ] Normalize the URL list
- [ ] For each profile: read header, contacts, face photo, about highlight, pinned links
- [ ] Open up to 3 pinned posts and copy captions
- [ ] Sequential thinking, thoughts 1–8, for this trainer only
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

A phone number is not left in `bio` or `about`. `save-draft.ts` deletes it from those texts after the verbatim check and writes the phone field as `+375 33 637-62-68`. That is the only trainer-card phone format on the site. `+375(33)637-62-68`, `+375297041326`, and `80297041326` all become that form. An account login number stays `+375336376268` in `users.phone`; the card still shows the spaced form.

### Face photo

Use only this browser and this account:

- Chrome user data dir: `/home/embatron/.cache/trenio-instagram-login`
- Instagram account signed in there: `embratron.eth`

Do not use the everyday Chrome profile and do not copy its cookies. Do not type or store the password. If that window shows a login wall, stop and ask the user to sign in once there.

The face photo is the profile-picture image whose alt is `{handle}'s profile picture`. `extract-profile.fn.js` reads that image id from the `src` filename, then keeps URLs the page itself already loaded whose path contains that id and which have no `stp` parameter. It downloads the largest of those files. Both sides must be at least 400px. A thumbnail URL is not rewritten.

`save-draft.ts` stores that file as `public/trainers/instagram/{handle}.jpg` and writes the sized files beside it (`s128`, `c320`, `c640`, `w960`). The catalog keeps using `{handle}.jpg`. A later import that has no source of at least 400px leaves the saved file in place.

Do not save `s100`, `s150`, or `s206`. Do not delete `stp` from a thumbnail URL and do not replace `s150` with `s1080`. The CDN answers `URL signature mismatch` or returns the thumbnail.

### 3. Read pinned captions

For each URL in `pinnedPosts`, open it and pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-post.fn.js` to `browser_evaluate`. Store `url`, `ogDescription`, `heading`, and `visibleText`. The caption is the verbatim post text inside that source, not a summary. Return to the profile only after the caption is stored. Then go back to the profile grid only to reach the next pin.

### 4. Sequential thinking

Call `sequentialthinking` in `user-sequential-thinking` eight times for this trainer. `totalThoughts` is 8. Do not start the next trainer inside this chain.

1. Quote the profile display line and bio. Do not decide the name yet.
2. Quote each pinned caption, up to three. State how many pins were marked. Do not quote unpinned posts.
3. List every given-name candidate with its quote. One candidate written for this account becomes `firstName`. None → empty. Two conflicting names → stop, do not save this profile.
4. Family name by the same rule.
5. Read the quotes again. If a given name stands next to the surname and `firstName` is empty or different, revise thought 3 (`isRevision: true`, `revisesThought: 3`).
6. Set `bio` to a verbatim slice of the profile biography. Set `aboutProfile` to `aboutFrames` unchanged. Set `about` to the pinned captions in pin order, one string each.
7. For every taxonomy phrase in the biography, the about frames, and the pins, decide `coached` or `practiced` from the clause that contains it. Coached: the same clause says they teach or lead it (`тренер`, `тренирую`, `инструктор`, `занятия`). Practiced: the clause says they do it themselves (`занимаюсь`, `хожу в`, `увлекаюсь`, `для себя`). A longer hobby alias does not become the headline. `primarySportSlug` is the coached sport the profile leads with. Also city, price, phone, email, telegram, languages, experience (`стаж N лет` or `более N лет`), and formats (`персональные` / `групповые`). `phone` is the number as printed. The save script moves it out of the description and stores `+375 33 637-62-68`.
8. Write the `resolved` object. Set `nextThoughtNeeded` to false only on this thought. `save-draft.ts` then sets `gender` to `male` or `female` from the given name. Do not put gender in `resolved` and do not show it on the public page or the trainer profile. Staff see it on the admin trainer card. The claim greeting uses it only to choose «был» or «была».

`resolved` shape:

```json
{
  "firstName": "",
  "lastName": "",
  "nameQuotes": [],
  "bio": "",
  "about": [],
  "aboutProfile": [],
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
  "formats": []
}
```

`nameQuotes` are verbatim slices that contain the saved name parts. `sportQuotes` are verbatim slices for every sport phrase. Each phrase is either coached or practiced. `aboutProfile` copies `aboutFrames`. `about.length` equals the number of pinned posts. Email and Telegram are copied as printed. They are not confirmed. `phone` may be the printed digits; the draft stores only `+375 33 637-62-68`, and that number is removed from `bio` and `about`.

### 5. Save

Write `data/instagram-trainers/_raw/{handle}.json` with the extract, the `pinned` array, and `resolved`. From the repo root:

```bash
./node_modules/.bin/tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts data/instagram-trainers/_raw/{handle}.json
```

If the script rejects the file, revise the thought it names and run it again. Do not edit the draft JSON by hand. The script refuses a given name that is not in the quotes, a given name that contradicts the name written next to the surname, a rewritten caption, and a city or price that the text does not state.

### 6. Report

One line per link: handle, full name, primary sport, city, pinned count, missing fields. Drafts stay unpublished. Call `browser_close` when the batch ends.

## Bulk

`/import-instagram-trainers` uses this flow for every link. A rejected profile does not discard drafts already saved.
