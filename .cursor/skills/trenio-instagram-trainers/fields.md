# Instagram draft fields

Drafts are unpublished `TrainerProfile` imports (`status: draft`, `createdSource: import`). They do not go into `src/routes/trainers.$slug.tsx`.

The name and the description are decided in sequential thinking, then checked by `scripts/save-draft.ts`. The script does not invent a Cyrillic given name from the header layout. When no given name is written anywhere, a name token in the handle is mapped to Russian and written into the note. A handle with no name token is stored as `firstName`.

| Draft field | Filled from | Leave empty when |
| --- | --- | --- |
| `slug` | The Instagram handle, lowercase, including dots and underscores. It is the account id, the nick, and `/trainers/{slug}`. It is unique across drafts and profiles. The same handle updates the same card. Another profile with that nick is rejected. The same given name and surname on a different handle is the same person: the save is rejected and the existing slug is reported. A given name without a surname does not match other cards. The nick is not edited in the product; support changes it | The handle is empty |
| `firstName`, `lastName` | A verbatim quote in the profile, a pinned caption, Threads, or the operator note. One name in the note replaces a different name on the page. When none of those write a given name, `firstName` is the Instagram handle and `lastName` stays empty | Two given names conflict and the note does not pick one |
| `gender` | `male` or `female`, set by `save-draft.ts` from the given name. A name ending in а, я, or Latin a is female, except a short list of male names such as Никита and Илья. A name ending in a consonant is male. `тренерка`, `инструкторка`, or `спортсменка` in the source forces female. Staff see «женский» or «мужской» on the trainer card. The public page and the trainer profile do not show the field. The claim greeting uses it only to choose «был» or «была» | The given name is missing or ambiguous (Саша, Женя) |
| `sourceBio` | Verbatim primary description. For a CSV import this is the `description` cell; otherwise it is the profile biography. Staff see it as «Текст из источника». A phone in it is removed | The source has no description |
| `sourceAbout` | Verbatim frames of the highlight titled «Обо мне», «О себе», «About», or «About me» | No such highlight |
| `bio` | Card text «Как меня представить». A coherent trainer-written description is kept after mechanical cleanup (`presentationMode: source`). Fragments are edited into natural, source-faithful prose (`adapted`). See Card text | Those sources have no meaningful words |
| `about` | Card text «Как проходят мои тренировки». Filled only when a spoken source, including a pin with `textRole: training`, explains the session process | Those sources never explain how a session works. Merely naming training or booking does not create this text |
| `photos` | Face photo first, then 2–3 gallery stills chosen by composition. Pinned stills come first, then other stills further down the grid, then Threads stills that show the person more clearly. A video, a reel, and a reel poster are not stored. At most 9. Files: `{handle}.jpg`, then `{handle}-g2.jpg`, `{handle}-g3.jpg`, … | No still of at least 400px that shows the trainer, a session, or the gym |
| `certificates` | A pinned image kept as a document. Caption is a verbatim slice that contains «диплом», «сертификат», or «удостоверение». At most 5. File: `{handle}-d1.jpg` | The pin is not a document, or the caption does not use those words |
| `audiences` | `adult`, `kid`, `teen` in that order, only when the text says so (`взрослые`, `дети` / `ребёнок`, `подростки` / `юниоры`, or all ages). The draft stays empty when the profile does not say. A later sync treats an empty list as adults | Not stated |
| `headline` | The profile line from the coached sports (`trainerIntroPhrase`): «Фитнес-тренер», «Инструктор тренажёрного зала», «Тренер по боксу и общефизической подготовке». The public page shows this field above the name | No sport matched |
| `sports`, `primarySport` | Taxonomy phrases inside `sportQuotes` | No sport phrase |
| `city` | The single Belarus settlement in the operator note, when the note names one. Otherwise the single settlement in the profile, the about highlight, pinned captions, and Threads | The note names several cities, or no note and zero or several cities. Leave `resolved.city` empty. When none are named and `address` is empty, the script stores Минск. Do not write that default into the card text |
| `address` | One to three short place queries from the biography, the about highlight, a pinned caption, the words on a pinned photo, Threads, or the operator note. The save script geocodes each one and stores the street. A whole sentence is rejected. A hall name that does not resolve is left out | No street or hall is named |
| `priceFrom` | A number next to BYN or руб | No price in the text |
| `languages` | A named language (`русский`, `беларуская`, `английский`, `польский`). The country name `Беларуси` is not the language | Not mentioned |
| `experienceYears` | Coaching experience only: `тренерский стаж N лет`, `стаж работы тренером N лет`, `опыт тренерской работы N лет`, or `тренирую N лет`. A bare `стаж N лет` is not this field and does not go on the card | The text does not say the years are coaching |
| `formats` | `персональные` / `индивидуальные` and `групповые` when those words are in the text | Not stated |
| `avatarPath` | The face file, also `photos[0]` when it exists. Playwright takes the largest file the page loaded for that same profile picture. The URL is not rewritten. A thumbnail is stored only when it is that largest file and no face of at least 400px is already saved. A new file of at least 400px replaces a saved face even when it has fewer pixels. A logo or a crop that cuts the face off is replaced by a clear portrait from a post | That URL is missing and no saved file of at least 400px exists yet |
| `contacts.phone` | The Belarus mobile in the operator note, when the note states one. Otherwise the mobile printed in the biography, the highlight, a pinned caption, Threads, or a `tel:` button. Stored as `+375 29 123-45-67`. Those digits are removed from the biography, the highlight, and the card text. No SMS and no confirmed mark | Not shown |
| `contacts.email` | An email in the operator note, when the note states one. Otherwise an email in the text, on Threads, or on a `mailto:` button. Stored on the card. No confirmation letter | Not shown |
| `contacts.telegram` | A Telegram link in the operator note, when the note states one. Otherwise a `t.me` link, or `@name` on a line that says Telegram, including Threads. Stored on the card. No bot confirmation | Not shown |
| `contacts.threads` | The attached Threads profile, when the message has one. Otherwise the one Threads profile link on the Instagram page (header button or biography). Stored as `https://www.threads.com/@handle` on the card. A post URL is not this field. No confirmation | Not shown |
| `contacts.website` | The profile external link, except Instagram, Threads, and Telegram | None |

## Name

`firstName` and `lastName` stay separate in the draft, the database, and the cabinet form. `fullName` is only those two joined. Public cards, the profile title, similar trainers, and the admin table show the given name on one line and the surname on the next.

The given name is whatever the profile, a pinned caption, Threads, or the operator note actually writes. A header that shows only a surname is not a reason to leave `firstName` empty when a pin, Threads, or the note writes the given name beside that surname. When the note states one given name, that name is saved even if the page shows a different one. When none of those sources write a person, split the handle on `_`, `.`, and digits, drop a role token (`trener`, `trainer`, `coach`, `fit`, `fitness`, `gym`), and map a remaining name token to Russian (`yana` is Яна, `vasiliy` is Василий). Write that name into the note. A token that is not a name stays out. When the handle has no name token, `firstName` is the handle itself (`potapooff20`) and `lastName` stays empty. «Без имени» is not a name. Role words (`тренер`, `coach`, `trainer`, `training`) are not given names.

## Description

The source stays verbatim. The public card either preserves that trainer-written description or adapts it without replacing the trainer's voice with a catalog template.

`sourceBio` is the primary trainer description. For a normal profile it is the Instagram biography. For a CSV import the raw `sourceDescription` contains the exact `description` cell and becomes `sourceBio`; the Instagram biography does not replace it. `sourceAbout` is the about-highlight frames. `pinned[].caption` is the pinned caption, `pinned[].imageText` is the words read off its slides, and `pinned[].textRole` says whether that text is `about`, `training`, `facts`, `promotion`, or `none`. `sourceThreads` is the Threads biography and the posts that were read. `operatorNotes` contains supplied prose and structured facts. A CSV description is not duplicated into `operatorNotes`. A phone number is removed from those texts and stored only in `contacts.phone`, unconfirmed. Unpinned Instagram posts are not a source.

Every pinned caption and slide is read for fields: sport, experience, audience, address, city, phone, price, email, Telegram, language, and format. A pin with `textRole: about` or `training` may also support card prose. `facts`, `promotion`, and `none` pins stay out of card prose. Follow [text-program.md](text-program.md) for classification and composition.

`bio` and `about` are the cabinet text. `resolved.presentationMode` records how `bio` was prepared:

- `source`: keep a coherent trainer-written description. Preserve meaningful sentences, point of view, distinctive phrases, and paragraph order. Remove only contact details, hashtags, Instagram interface text, repeated headings, and booking calls. A short usable text is better than a padded rewrite.
- `adapted`: use when the material is fragments, a profile-label stack, or a scrape. Join related ideas, remove repetition, and make the text readable while keeping the trainer's wording and intent. Do not force first person. Do not generate «Я [имя], тренер по … в [городе]», «Город …», or another universal introduction.

In either mode, do not add a city, price, year, result, method, benefit, or sport that the sources do not state. The name, headline, sports, city, formats, and audiences already have separate fields. Mention one only when it belongs to the trainer's own description, not to complete a template. No HTML, links, @names, hashtags, or calls to write in direct. A pinned caption supports public prose only after it is classified as `about` or `training`.

«Как меня представить» (`bio`) is what a person reads first. Select the strongest trainer-authored source: supplied description first, then profile biography, about text, Threads, and operator prose. Use the whole coherent description when it is useful. If it needs adaptation, lead with its strongest concrete idea: what the trainer helps with, their approach, relevant achievement, or who they work with. Do not automatically lead with identity metadata. Keep enough detail to be useful; up to 900 characters for an adaptation and 1600 for a preserved source. Do not pad. A practiced sport may appear only as something they do themselves, never as the sport they coach.

«Как проходят мои тренировки» (`about`) answers how a session works: structure, warm-up, technique, load selection, exercise choice, sparring, progression, or work on mistakes. Merely saying «персональные тренировки», naming a venue, listing sports, or inviting someone to book does not answer that question. Preserve useful trainer-written process text or adapt it faithfully. Up to three short paragraphs, at most 1600 characters and 8 sentences. Leave it empty when the process is not described. A `training` pin may supply this text from its caption and slides; other pin roles may only fill fields.

Each card text carries `presentationQuotes` or `trainingQuotes`: verbatim slices of the biography, the about highlight, the pinned image text, Threads, or the operator note. A number in the card text must already appear there. A street named in a pin is a place query, not a sentence in this text.

Sample, not data. Biography: `Владимир. Минск. Кикбоксинг и бокс. ОФП для любого уровня`. This is fragments, so `adapted` may say `Кикбоксинг, бокс и ОФП для любого уровня подготовки.` It does not fabricate `Я Владимир, тренер … в Минске`. A coherent note `Помогаю фигуристам-любителям уверенно встать на коньки и освоить базовую технику.` stays in `source` mode after cleanup. A pin that says `Групповые тренировки для детей, пр. Пушкина, 68А` sets `formats` to group, `audiences` to kid, and the place query to `пр. Пушкина, 68А`; it does not create training text. A pinned slide that explains how the hour is built is `imageText` and can fill training. The slide is not a gallery photo.

## Photo search

Photo search runs for every trainer, including a profile with no pins.

The face photo is the profile picture when that picture shows the person. Rules for its URL are in the skill. It is `photos[0]`. CDN copies of that one picture keep the largest file the page loaded. A different picture is not chosen because it is larger.

Then judge stills from the pinned posts, at most three posts and at most two images stored per post. A pinned reel is read for text and stores no file. Read each complete caption and every text slide, then assign `textRole`. After that, scroll the grid and open other photo posts until the gallery holds two or three stills or the grid ends. A reel tile is not opened. Threads stills from the posts that were read get the same gallery or skip verdict and compete for those same slots. Unpinned Instagram captions stay off the card and out of the fields. Both sides at least 400px. That floor rejects a thumbnail. It does not rank the frames. The same file as the face is a duplicate, not a second photo. A gallery file is JPEG, PNG, WEBP, or GIF.

Keep a gallery photo when it shows this trainer, a session, the gym, or the class, and a person can see who it is without squinting. Prefer an unobstructed face, then a readable action, then the room with the trainer in it. Skip a text card, a quote image, a logo, a flyer, another person's portrait, a crop that cuts the face, a collage, a crowd where the trainer cannot be picked out, a back-of-head shot when a clearer frame exists, and a blur. Skip reasons: `text`, `logo`, `flyer`, `duplicate`, `not-trainer`, `crop`, `clutter`, `crowd`, `back`, `blur`. One clear frame beats three weak ones. List the strongest gallery frame first. When no still clears that bar, keep the still photos the profile has, including a back view or a crop, so the card is not left without a picture. A reel, a reel poster, a video, and a story are never a trainer photo, including when they are the only frame on the profile. A carousel photo is a photo. Scroll to the bottom of the grid when the posts above are video. Do the same on an attached Threads profile.

Keep a certificate only when the picture is a document and the pinned caption contains «диплом», «сертификат», or «удостоверение». The caption stored on the document is a verbatim slice of that post, at most 80 characters, and it contains one of those words. A diploma does not also sit in the gallery.

Every stored pinned image is either kept or skipped. At most 8 gallery photos besides the face, and at most 5 certificates.

The address is a short place query, not the sentence it was found in. The save script geocodes it. Abbreviations (`ул.`, `пр.`, `пер.`, `вул.`, `праспект`) and a Belarusian street name are tried as separate lookups. A hit that does not share the street or the place name is rejected. The stored line is the street from the match. A hall name that does not resolve is not stored. The street is not written into the training text unless the biography, the highlight, the pinned image, Threads, or the note also describes the session.

## Sport

`sportQuotes` lists every taxonomy phrase in the biography, the about highlight, the pinned captions, the pinned image text, Threads, and the operator note. Sequential thinking marks each phrase `coached` or `practiced`. An inflected form counts: `йоге` is йога, `пилатесу` is пилатес. A hashtag that glues the sport to a city still counts.

A phrase is coached when the same clause says the person teaches or leads it, or when the profile presents them as a trainer and the sport is in a list or on an about slide. A phrase is practiced when the clause says they do it themselves and does not say they teach it. A phrase is unrelated when the same letters are not the sport, such as «борьба с РПП». The headline and `sports` use coached phrases only. When a specific sport and its section both match, the specific sport is the headline. The longest alias does not win: hiking in «хожу в походы» stays practiced even when that alias is longer than ОФК.

`бокс` does not match inside `кикбоксинг`. `тайским боксом` is тайский бокс, not бокс. `тренажёрный` and `тренажерный` are the same phrase. The words `тренер` and `тренировки` are not sports unless a taxonomy alias contains them. `тренируюсь` is the person training, not coaching.

## Files

- Raw extract plus `resolved`: `data/instagram-trainers/_raw/{handle}.json`
- Draft: `data/instagram-trainers/{handle}.json`
- Batch index: `data/instagram-trainers/index.json`
- Avatar: `public/trainers/instagram/{handle}.jpg`
