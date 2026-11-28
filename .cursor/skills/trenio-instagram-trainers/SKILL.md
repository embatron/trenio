---
name: trenio-instagram-trainers
description: >-
  Imports public Instagram trainer profiles into Trenio draft records with the
  Playwright MCP and a per-trainer sequential-thinking pass. Applies operator
  notes and an attached Threads profile.   Chooses photos by composition, not by
  pixel size, reads the words on a pinned photo, geocodes the street, and
  writes card text a person can read aloud. Each saved draft
  is copied to the production server and stays unpublished. Use when the user
  pastes instagram.com profile links, adds a Threads link or facts about the
  trainer, asks to parse or import trainers from Instagram, or runs
  /import-instagram-trainers, including a bulk list.
---

# Instagram trainer import

Read a public Instagram profile the user supplied. Apply the facts the user wrote in the same message, and read a Threads profile when the user attached one. Then run photo search, open up to three pinned posts, read their captions and every text slide, and decide the trainer fields in sequential thinking. Prepare text with the mandatory staged [trainer text program](text-program.md). The save script checks those decisions against the Instagram page, approved pinned about/training text, Threads, and the operator note. It geocodes a short place query and stores the street. It does not choose the name. Taxonomy, card text, and photos: [fields.md](fields.md).

This skill governs `data/instagram-trainers/` and `public/trainers/instagram/`. It does not publish a profile. `status` stays `draft`. The trainer publishes it in the cabinet after the magic link.

Every profile gets its own photo search and its own card text. Do not reuse a sentence or a photo decision from the previous trainer. The card must keep this trainer's voice. It has two modes:

- `source` — keep a coherent trainer-written description, with only mechanical cleanup: remove contact details, hashtags, interface debris, repeated booking calls, and duplicated headings.
- `adapted` — when the source is fragments, edit those fragments into natural prose while preserving the point of view, characteristic wording, and every stated fact.

Do not force first person. Do not start with «Я [имя], тренер по … в [городе]» unless the trainer actually wrote that line. The name, headline, sports, and city already have separate fields and do not need to be repeated in the opening paragraph.

## Do

- Use `user-playwright` for the page and `user-sequential-thinking` for the decision. Discover a tool with `GetDynamicTools` before calling it.
- Treat the Instagram handle as the slug and the account id. Before opening a profile, look up that handle and that given name plus surname in `data/instagram-trainers/` and in `trainer_profiles`. The same handle is the same card: update it. The same given name and surname on another slug stops the import. Report that slug. A given name without a surname is not matched to other cards.
- Finish one trainer, including all eleven thoughts and the save, before opening the next profile.
- Keep the biography, the about-highlight frames, and the pinned captions verbatim in `sourceBio`, `aboutProfile`, and `pinned[].caption`.
- Write «Как меня представить» and «Как проходят мои тренировки» with [text-program.md](text-program.md). The primary description, biography, about highlight, pinned `about`/`training` captions and slides, Threads, and operator prose are eligible sources. A `facts`, `promotion`, or `none` pin fills fields only. Prefer `source` when the trainer already wrote a coherent description. Use `adapted` for a list, slogan, scrape, or disconnected fragments. Adapt by editing, not by replacing the trainer with a generic catalog voice.
- Run photo search for this trainer even when the profile has no pins. Keep a still because the person and the session read clearly. A larger file does not win. A video, a reel, and a reel poster are not photos. Scroll the grid, to the bottom if the posts above are video, until two or three stills are chosen or the grid ends.
- Apply every fact the operator wrote for this account. A note can fill a field the profile never states. For the name, city, phone, email, Telegram, price, and coaching years, the note replaces the page when it states a different value.
- When the message includes a Threads profile, read the header, the biography, and the posts. Apply that text the same way as the biography. Judge its still photos with the same gallery or skip verdict. Scroll that profile past videos too.
- Save a phone, email, or Telegram link when the profile, Threads, or the note shows it. Do not send a code and do not mark it confirmed.
- Copy a Belarus mobile from the biography, the about highlight, a pinned caption, a `tel:` button, Threads, or the operator note into the phone field. Store that number as `+375 29 123-45-67`. Do not send SMS and do not mark it confirmed. Remove it from the biography, the highlight, and the card text. When the note states a mobile, that number is the one that is stored.

## Closed accounts

`latysheu` is closed. Do not open that Instagram profile, do not import it, do not update the draft, and do not copy it to the server. `isSilentInstagram` refuses the handle in `save-draft.ts`. Report the handle and leave it out of the batch. This does not expire.

## Do not

- Open, import, or message `latysheu`. The account is closed.
- Call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API. The source is the public profile page.
- Ask the user for an Instagram password, or commit one. The import login is the gitignored `.cursor/skills/trenio-instagram-trainers/LOGIN.md`. Read it and sign in when the page is a login wall. Do not print the password.
- Save an `s100`, `s150`, or `s206` thumbnail as a photo, or edit a thumbnail URL (delete `stp`, or replace `s150` with `s1080`).
- Read Instagram from any browser profile except the import profile named below.
- Invent a Cyrillic given name that the handle does not contain, or copy a name from a previous trainer or from an example in this skill. When the cells, the full name, and the description write no person, split the handle on `_`, `.`, and digits, drop a role token (`trener`, `trainer`, `coach`, `fit`, `fitness`, `gym`), and map a remaining name token to Russian (`yana` is Яна, `vasiliy` is Василий, `emelyanenko` is Емельяненко). That pair goes in the note. When the handle has no name token, `firstName` is the handle.
- Save a second slug for a person who already has a card. The same given name and surname is that person. Update the existing slug.
- Leave the given name empty when the profile, a pinned caption, Threads, or the operator note writes that name next to the surname.
- Save when two different given names are written for the same surname and the operator note does not pick one.
- Treat the latest posts as pinned when no pin mark is visible. Open at most three pinned posts. Other posts supply gallery photos only, and only stills that pass the composition bar. Their captions are not profile facts. Do not open a reel tile, and do not stop the photo search because the first screen is video.
- Turn a hobby into the coached sport. «Хожу в походы» and «занимаюсь тайским боксом» are not «тренер по походам» or «тренер по тайскому боксу».
- Dump Instagram interface text, follower counts, hashtags, contact details, or a chain of profile labels into the card. A coherent trainer-written biography, supplied description, or approved pinned `about`/`training` text may be kept in `source` mode after mechanical cleanup.
- Use a pinned caption in public prose without assigning its semantic `textRole`. `facts`, `promotion`, and `none` captions never become card copy. Every caption may still fill sport, experience, audience, address, city, phone, price, email, Telegram, language, and format.
- Rank two different pictures by width or height. Skip a clear portrait because another file has more pixels.
- Ignore a fact the operator wrote, or stop a Threads profile after the first line of the biography. Skip the Threads photo verdict, or keep a Threads video as a gallery photo.
- Write the card as labels, hashtags, a pipe-separated slogan, or a pasted caption.
- Save a text card, logo, or flyer as a gallery photo. Save a diploma as a gallery photo. Save a frame that cuts the face, hides the person in a crowd, or is mostly a blur, when a clearer frame of the same trainer exists.
- Save a reel, a reel poster, or any video as the face or as a gallery photo. A pinned reel keeps its caption and stores no image. An empty gallery is the result when the profile has only video.
- Reply, like, or otherwise react to a story. Open the about highlight only to read it.
- Write the draft into `src/routes/trainers.$slug.tsx`. Store a whole sentence as the address. The script geocodes a short street or hall.
- Set `status` to `published`. A request to put the account on the server still leaves the row a draft.

Wrong: the header shows only a surname, so the given name is left empty even though a pinned caption states it.
Wrong: two pinned captions use two different given names, and one of them is picked.
Wrong: a promotional pinned caption is relabeled as training and pasted into «Как проходят мои тренировки», or a text card from that pin is saved as a gallery photo.
Wrong: the grid is reels, so the reel poster is saved as the gallery or as the face.
Wrong: the address field is the whole sentence that mentioned a hall.
Right: one given name is written in the profile, a pinned caption, the about highlight, Threads, or the operator note, and that exact name is saved. «Я Аня» stays Аня. A note that says «Анна Козлова» is saved even when the profile header has no name, and it replaces a different name the page shows. A profile and a note that give no name are saved as the handle: `firstName` `potapooff20`, `lastName` empty.
Right: the bio says she coaches ОФК and ЛФК, and that she goes hiking. ОФК is the coached sport. Hiking is stored as practiced, not as the headline.
Right: the biography says `тренер`, and the next lines are `йога, пилатес`. Both are coached. `йоге` and `пилатесу` are those same sports. A sport written only on a pinned photo is still classified.
Right: a `facts` pin that says the group is for children, the price is 40 BYN, and the hall is on a named street fills audiences, price, and the place query but not the card paragraph. A `training` pin that explains warm-up, technique work, and load selection may support the training block. The script geocodes `пр. Независимости, 32А` and stores the street from that match. A text slide is copied into `imageText` and is never a gallery photo.
Wrong: the source says «помогаю встать на коньки с нуля», and the card says «помогаю тем, кто никогда не стоял на льду».
Wrong: the description is already usable, but the card replaces it with «Я Анна, тренер по пилатесу в Минске».
Right: a coherent trainer-written description is kept in `source` mode. Contact details, hashtags, «пишите в директ», and duplicated headings are removed; its voice and paragraph order stay.
Right: the source is `Кикбоксинг. Минск. Дети и взрослые.` In `adapted` mode the card may say `Работаю с детьми и взрослыми — от первого знакомства с кикбоксингом до регулярных тренировок.` only when those ideas are stated. It does not add a name-and-city template.
Wrong: `Запись на тренировки` becomes «Как проходят мои тренировки». A booking call says nothing about the session, so that field stays empty.
Right: the top of the grid is reels. Those tiles stay closed. The search scrolls to a still photo lower on the page and judges that file. A reel poster is not that still. A Threads post that shows the same person training is judged the same way, and its text fills the fields. A Threads video stores no frame.

## Flow

```
Import progress:
- [ ] Normalize the URL list, the operator note, and any Threads link. Look up the handle and the name. The same handle is an update. The same person on another slug stops here
- [ ] For each profile: header, contacts, face photo
- [ ] About highlight, when that title exists
- [ ] Threads profile, when the user attached one: header, biography, post text, and a gallery-or-skip verdict for each still
- [ ] Each pinned post: read the complete caption and every text slide, assign `textRole`, then store at most 2 stills. A pinned reel keeps its text and stores no frame
- [ ] Run the eleven-stage trainer text program and pass its final quality gate
- [ ] Scroll the grid past reels. Open still-photo posts until two or three gallery photos are chosen or the grid ends
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

A Threads profile is read in the same import browser, after the Instagram header and before the pinned posts. Expand the biography. Copy the header, the biography, and the links into `threads`. Then walk the posts from the top. Open a truncated post and copy the full text. A video post is not a photo: leave its `photos` empty and keep its text. A still image is stored, at most two files from that post, and judged with the same gallery or skip verdict as an Instagram frame.

Keep going while a post adds a fact or a still photo. Scroll the Threads profile when the posts on screen are video. Stop at 12 stored posts, or at the bottom of the profile. Three posts in a row that add no fact do not end the walk while a still photo is still missing.

Store `threads.url`, `threads.headerText`, `threads.bio`, and `threads.posts[]` with `url`, `text`, and `photos`. Contacts and other facts found there fill the same fields as Instagram. A Threads post may supply a quote for the card text. A pinned Instagram caption may do the same only with `textRole: about` or `training`.

`threads.url` is also the public Threads contact. `save-draft.ts` stores it as `https://www.threads.com/@handle` on `contacts.threads` and `threadsUrl`, and the import writes that URL to `trainer_profiles.threads`. When the message has no Threads profile, the same contact is the one profile link on the Instagram page: a header button, or `threads.com` / `threads.net` in the biography. A post URL is not the contact. Several different profile links and no attached profile fail the save. An older draft with no Threads URL does not clear a link the trainer already saved in the cabinet.

Thought 2 is the Threads verdict: which facts the text supports, and for every stored still, gallery or skip and why. Threads stills compete with Instagram frames for the two or three gallery slots. Keep a Threads frame when it shows the trainer more clearly than a weaker Instagram frame, or when Instagram has no still. Do not add one only to increase the count.

On a Threads login wall, use the same import Chrome profile and `LOGIN.md`. Do not print the password. A checkpoint stops the batch.

### 2. Read the profile

`browser_navigate`, then `browser_snapshot`.

- Cookie dialog: reject optional cookies, or allow all if that is the only choice. Do not click Follow, Message, or Log in.
- Login wall: read `.cursor/skills/trenio-instagram-trainers/LOGIN.md` and sign in. Do not print the password. If that login fails, stop and say so.
- Checkpoint: stop the batch.
- Unavailable profile: record the failure and continue.

The extract clicks `more` / `ещё` when the biography is folded. Wait and evaluate a second time, then keep that `headerText`. Also read `contacts` (`mailto:`, `tel:`, `t.me`, and a Threads profile link) and `highlightLinks`.

Pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-profile.fn.js` as `function` to `browser_evaluate`. `pinnedPosts` lists only tiles with a pin mark, at most three. If the snapshot shows a pin and `pinnedPosts` is empty, evaluate once more. If it is still empty, continue with no pinned posts. Other grid posts are opened later, and only to choose two or three gallery photos.

### About highlight

If a highlight title is `Обо мне`, `О себе`, `About`, or `About me`, open that highlight only. Confirm `View story` when Instagram asks. Do not reply and do not like. Pause on each frame. Copy the sticker text on that frame into `aboutFrames`, one string per frame, in order. Story text is often drawn on the image, so read the frame image. Skip a frame that has no words. Stop when the first frame repeats or the highlight title changes. Close it before the next profile.

### Contacts

Phone, email, and Telegram come from the biography, the about frames, the contact buttons, Threads, the operator note, and `t.me` / `mailto:` / `tel:` links. Put each value into the matching profile field. Do not create an account, do not send SMS or email, and do not mark the contact confirmed. Leave the field empty when none of those sources show it. A Threads or YouTube link is not Telegram.

The Threads contact is the profile URL, not the post text. An attached Threads profile wins. Otherwise store one profile link found on the Instagram page. The save script canonicalizes it to `https://www.threads.com/@handle`. Do not confirm it. The public icon stays hidden until that URL is stored and the trainer publishes the page.

A Belarus mobile in the biography, the about highlight, a pinned caption, a `tel:` button, Threads, or the operator note is copied into the phone field. `save-draft.ts` stores that same number as `+375 29 123-45-67` and then deletes it from `sourceBio`, `sourceAbout`, `bio`, and `about`. `+375(29)123-45-67`, `+375291234567`, and `80291234567` are one mobile and become that spaced form. The script does not send SMS and does not mark the number confirmed. The public profile hides it until the owner confirms it. Leave the field empty when no source shows a mobile. When the note states one mobile, store that number even if the page prints a different one.

### Face photo

Use the one shared Chrome from `.cursor/rules/browser.mdc` (`user-playwright`). Do not launch another Chrome and do not close that window. The Instagram account signed in there is `trenioby`. The password is in the gitignored `LOGIN.md` next to this skill.

Do not use the everyday Chrome profile and do not copy its cookies. On a login wall, sign in with that note in the shared window. Do not print the password and do not commit `LOGIN.md`.

The face photo is the profile-picture image whose alt is `{handle}'s profile picture`. Click that picture, then let the page load. `extract-profile.fn.js` reads the image id from the `src` filename and downloads every URL the page itself already loaded for that id. It keeps the file with the greatest width and height. The URL is not rewritten: do not delete `stp`, and do not replace `s150` with `s1080`. The CDN answers `URL signature mismatch` or returns the thumbnail.

`s100`, `s150`, and `s206` are thumbnails. Save one only when it is the largest file the page loaded for that same picture and no saved face of at least 400px is already on disk. Among CDN copies of one profile picture, keep the largest file the page loaded: that is the same crop, not a different composition. A new file of at least 400px on both sides replaces a saved face, even when it has fewer pixels. A file below 400px does not replace a saved face.

The profile picture stays the face when it shows this person, including a back view or a flex. When it is a logo, a text card, or a crop that cuts the face off, and a judged photo is a clear portrait, put that portrait's bytes in `avatarBase64` and do not use the logo as the face. The gallery does not repeat that same file. When no still clears the composition bar, still save the profile picture. An empty gallery is only for a profile whose posts are videos or stories. A gallery file is a static image the page loaded: JPEG, PNG, WEBP, or GIF. A video, a reel, a reel poster, and a story frame are not gallery photos.

`save-draft.ts` stores that file as `public/trainers/instagram/{handle}.jpg` and writes the sized files beside it (`s128`, `c320`, `c640`, `w960`). The master JPEG is sent through TinyPNG when `TINIFY_API_KEY` is set. The catalog keeps using `{handle}.jpg`.

### 3. Pinned posts and photo search

Photo search is part of every trainer, not a separate command.

For each URL in `pinnedPosts`, open it, take a screenshot, and pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-post.fn.js` to `browser_evaluate`. Store `url`, `ogDescription`, `heading`, `visibleText`, and `photos`. The caption is the verbatim post text inside that source, not a summary.

Read every pinned slide, including a text card. Copy visible words into `pinned[].imageText`, one string per slide, in order. Skip a slide that has no words. Then assign `pinned[].textRole` with [text-program.md](text-program.md): `about`, `training`, `facts`, `promotion`, or `none`. A caption or slide with `about` or `training` may support public prose; every role may fill structured fields. Do not save a text slide as a gallery photo.

`photos` holds at most two images from that post. The extractor downloads a file the page already loaded. An `stp` of `s100`, `s150`, or `s206` is skipped. A display URL such as `stp=dst-jpg_e35` is kept when both sides are at least 400px. It does not rewrite a thumbnail URL. 400px is the floor that rejects a thumbnail. It is not a reason to prefer one picture over another. If `carouselNext` is true, click the control named Next, Далее, Вперёд, or Следующий, up to four times. Screenshot each slide. Extract again and merge by file stem. Do not click Like. From the slides you opened, store the two images you will judge. Choose those two by the frame, not by the pixel count. Do not store a fifth slide.

Look at the grid tile before opening a post for a gallery photo. The extract marks each tile `photo` or `reel`. Do not open a `reel`. A reel is a video, and its poster is not a photo. Open a `photo` tile that shows a person or a session. Skip a tile that is a text card, a collage, or a flyer. Still open a pinned post when the tile is a text card or a reel: read the caption and any words on a still. Store no file from a reel. If `extract-post` returns `video: true`, store no photo from that post.

Judge every stored image, including Threads frames, from the screenshot:

- `gallery` — this trainer, a session, the gym, or the class, and the frame reads at a glance. Saved after the face as `{handle}-g2.jpg`, `{handle}-g3.jpg`, and so on. List the strongest frame first in `photoKeeps`. The script saves gallery files in that order.
- `certificate` — a document, and the caption contains «диплом», «сертификат», or «удостоверение». Saved as `{handle}-d1.jpg` with a verbatim caption. Not also a gallery photo.
- skip — `text`, `logo`, `flyer`, `duplicate` (the same file as the face), `not-trainer`, `crop` (face cut at the chin or eyes, or the frame is mostly floor, ceiling, or a wall), `clutter` (collage, chat screenshot, text burned over the photo), `crowd` (this trainer cannot be picked out), `back` (only the back of the head when a clearer frame exists), or `blur` (motion blur or a dark frame where the person is not readable).

Prefer, when several frames clear the floor: a portrait or three-quarter with the face unobstructed; then the trainer coaching or training, body in frame, the action understandable; then the gym only when the trainer is in it. A still moment beats a motion blur. An empty hall loses to a session. One strong frame is enough. Do not pad the gallery with a weaker frame to reach three when a stronger frame is already kept. When every still photo fails that bar, keep the still photos the profile has, including a back view or a crop, so the card is not left without a picture. A reel, a reel poster, a video, and a story are never that fallback: store no file from them. A carousel photo is a photo.

A profile with no pins still finishes photo search. After the pins, scroll the profile grid and open other `photo` tiles until two or three gallery photos are chosen, or the grid ends. The first extract only lists tiles already loaded. Scroll, then extract again. Trainers often fill the top of the page with video, so keep scrolling, to the bottom of the grid if that is where the stills are. Do not stop because the first screen is reels. A reel is not opened and is not stored. The photo posts you open are `extraPosts`, at most 12, and their captions are not quotes for the card. A text card, logo, or flyer is skipped. The same scroll applies to a Threads profile that was attached: pass videos, copy the text, and judge the stills.

Return to the profile only after that post's caption and photos are stored. Then go back to the profile grid only to reach the next pin.

### 4. Sequential thinking

Call `sequentialthinking` in `user-sequential-thinking` eleven times for this trainer. `totalThoughts` is 11. Do not start the next trainer inside this chain.

1. Quote the profile display line and bio. Quote the operator note verbatim. Do not decide the name yet.
2. Threads verdict. Quote the header, the biography, and each post you stored. Say which facts that text supports. For every Threads still, say gallery or skip and why. A video is not a photo. If the message has no Threads link, say so. Do not decide the name yet.
3. Quote each about frame, each complete pinned caption, and each `imageText` string, up to three pins. Assign every pin `textRole` and justify it. State how many pins were marked, how many photos were stored, and which slides were text. Do not quote unpinned posts.
4. List every given-name candidate with its quote, including the note and Threads. One name the operator note states becomes `firstName`, even when the page writes another. No note and one name written for this account → that name. None → `firstName` is the Instagram handle and `lastName` stays empty. «Без имени» is not a name. Do not invent a different name. Two conflicting page names and no note → stop, do not save this profile.
5. Family name by the same rule. The note wins when it states a surname.
6. Read the quotes again. If a given name stands next to the surname and `firstName` is empty or different, revise thought 4 (`isRevision: true`, `revisesThought: 4`). The operator note wins over the page.
7. For every taxonomy phrase in the biography, the about frames, the pins, the pinned image text, Threads, and the note, decide `coached` or `practiced`. Read the inflected form: `йоге` is йога, `пилатесу` is пилатес, `настольному теннису` is настольный теннис. A hashtag that glues the sport to a city still counts. Coached: the same clause says they teach or lead it (`тренер`, `тренирую`, `инструктор`, `занятия`), or the profile presents them as a trainer and the sport is in a list or on an about slide. Practiced: the clause says they do it themselves (`занимаюсь`, `хожу в`, `увлекаюсь`, `для себя`) and does not say they teach it. A longer hobby alias does not become the headline. A taxonomy phrase that is only the same letters inside a sentence the operator wrote is unrelated. Keep that sentence. When a specific sport and its section both match, `primarySportSlug` is the specific sport. Otherwise it is the coached sport the profile leads with. The note's coached sport leads when the page names none. The same quotes fill fields. `address` is one to three short place queries separated by ` | `: the street and house number, or the hall name, each a verbatim slice of at most eight words. Do not paste the sentence around it. The save script geocodes each query and stores the street from the match. A hall name that does not resolve is left out. City, price, phone, email, telegram, languages, coaching experience only (`тренерский стаж N лет`, `стаж работы тренером`, `опыт тренерской работы`, `тренирую N лет`; a bare `стаж N лет` stays out of the field and out of the card), formats (`персональные` / `групповые`), and audiences (`взрослые`, `дети`, `подростки`) come from the same quotes. A fact that appears only in a pin, on a pinned photo, in Threads, or in the note still fills the field. For name, city, phone, email, Telegram, price, and coaching years, one value in the note replaces the page. `phone` is the number as printed. The save script copies it into the phone field, stores the spaced form, and removes it from the description. It does not confirm the number.
8. Photo search. For every stored still, including Threads, say gallery, certificate, or skip, and why the frame won or lost. Say what the frame shows. A text card is `text`: transcribe it, do not keep it. A reel, a video file, and a reel poster are not in this list. Do not cite pixel size as the reason, except to reject a file below 400px. The face photo is already kept and is not in this list. List gallery keeps with the clearest frame first. Say how far down the grid you scrolled.
9. Run stages 1–5 of [text-program.md](text-program.md): verify source capture, inspect pinned posts as documents, build the evidence ledger, identify the trainer's voice, and choose `presentationMode`. Then write `presentation` («Как меня представить») and `presentationQuotes`.
   - Choose `source` when the primary description is already coherent and useful. Keep all meaningful sentences and their order. Remove only contact details, hashtags, interface debris, duplicate headings, and booking calls. Do not prepend a generated introduction.
   - Choose `adapted` when the source is a list, slogan, scrape, or disconnected fragments. Keep the trainer's point of view and distinctive phrases. Join related ideas, remove repetition, and make the result readable. Do not force first person, do not write «Город Минск», and do not restate the name, headline, sport, or city merely because those fields exist.
   - The result may be longer than four sentences when the source has substance. Do not pad a thin source. Every claim stays grounded in the quotes. A pinned caption is eligible only when its `textRole` is `about` or `training`.
10. Run stages 6–9 of the text program. Write `training` («Как проходят мои тренировки») and `trainingQuotes` only when an approved spoken source explains the process: how the session is built, what is worked on, how load or exercises are selected, or what happens during training. A booking call, `персональные тренировки`, a venue, or a sport list is not a process description. Preserve useful trainer-written session prose; otherwise adapt it faithfully. Leave the field empty when the process is not described.
11. Run the text program's human edit and final quality gate, then write the `resolved` object. Set `nextThoughtNeeded` to false only after every line is grounded and every pin has a role. `save-draft.ts` then sets `gender` to `male` or `female` from the given name. Do not put gender in `resolved` and do not show it on the public page or the trainer profile. Staff see it on the admin trainer card. The claim greeting uses it only to choose «был» or «была».

`resolved` shape:

```json
{
  "firstName": "",
  "lastName": "",
  "nameQuotes": [],
  "sourceBio": "",
  "aboutProfile": [],
  "presentationMode": "source",
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

`nameQuotes` are verbatim slices that contain the saved name parts. A slice may come from the profile, a pin, Threads, or the operator note. `sportQuotes` are verbatim slices for every sport phrase. Each phrase is either coached or practiced. `aboutProfile` copies `aboutFrames`. Email and Telegram are copied as printed. They are not confirmed. `phone` is the mobile from the profile, a pin, a pinned photo, Threads, or the note. The draft stores that number as `+375 29 123-45-67`, unconfirmed, and removes it from the source and the card text. `address` is one to three short place queries. The save script geocodes them and writes the street. `presentationQuotes` and `trainingQuotes` are slices of the primary description, biography, about highlight, approved pinned `about`/`training` caption or slide, Threads, or operator note. A CSV raw file stores its exact `description` in `sourceDescription`; do not mix it into structured operator facts. The raw file also stores `operatorNotes`, `threads`, and each pin's `textRole` and `imageText`. Do not put those objects inside `resolved`.

Do not set `bio` or `about` inside `resolved`. The script writes those from `presentation` and `training`. `audiences` stays empty when the profile does not name who they teach. Order, when it does: `adult`, `kid`, `teen`. A certificate keep also has `caption`.

### 5. Save

Write `data/instagram-trainers/_raw/{handle}.json` with the extract, `operatorNotes`, `threads`, the `pinned` array (caption, `textRole`, every text slide, and judged photos), and `resolved`. From the repo root:

```bash
./node_modules/.bin/tsx .cursor/skills/trenio-instagram-trainers/scripts/save-draft.ts data/instagram-trainers/_raw/{handle}.json
```

If the script rejects the file, revise the thought it names and run it again. Do not edit the draft JSON by hand. The script refuses a given name that is not in the quotes, a given name that contradicts the name written next to the surname unless the operator note states the saved name, a pasted caption or Threads post, a card sentence that adds a city, number, or sport the sources do not state, and a city or price that the text does not state. It also refuses the generated «Я … тренер … / Город …» opening in `adapted` mode and a booking call used as training text. `source` mode must retain most of the source wording. It geocodes each place query. A matched street replaces the query. A query that is a whole sentence is rejected. A single city, phone, email, Telegram, price, or coaching-year value in the note replaces the page. When no source names a settlement and no street is named, leave `city` empty: the script stores Минск. Do not write that default into the card text. The profile crumb is then «Тренеры в Минске». A city that only the geocoder found is stored and is not added to the card.

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

One line per link: handle, full name, primary sport, practiced sports, city, the stored street or that the place did not resolve, phone, email, telegram, `source` or `adapted` presentation mode, pinned count, whether pinned image text was read, face side in pixels, gallery count, certificate count, whether the training text was written, whether an operator note was applied, whether Threads was read, and fields still empty. Drafts stay unpublished. Say that the draft is in the local database and on the server. Leave the shared browser open.

## CSV list

A path to `coaches_import.csv` is the source list. The project file is `data/instagram-trainers/coaches_import.csv`. The command `.cursor/commands/import-instagram-trainers.md` has the column map. One row is one trainer at one club. Group by the Instagram handle. One handle is one card.

The cells already decide the name, the biography, the city, the street, the coached slugs, and the club. Do not open the profile, a pin, or a highlight to find those again. Store the exact CSV `description` in raw `sourceDescription`; keep structured name, city, sport, and place facts in `operatorNotes` without duplicating that description. Choose `source` for a coherent description and `adapted` for scrape fragments. When the name cells, the full name, and the description are a role or empty, read the handle as in the command: a name token becomes the Russian given name or surname and is written into the note. A handle with no name token stays the given name. `followers` is ignored. `Сморгонь` is stored as `Смаргонь`. The note names one city. A fourth place and a second city are reported, not forced into the card.

Skip a row with no `category_slugs`, and a row whose description is a shop, a bar, a delivery service, or a course brand. The same handle already on disk is an update.

Instagram is opened for the face, gallery stills, header contacts, and pinned text. The CSV description remains the primary narrative and its decided name, city, street, and sports are not rediscovered. Still read a pinned «О себе», approach, or training-process post when it adds useful detail; classify it with `textRole` and use it only as supplementary evidence under the text program.

## Bulk

`/import-instagram-trainers` uses this flow for every link. A CSV batch uses the CSV list above and this same save. A rejected profile does not discard drafts already saved.
