# Instagram draft fields

Drafts are unpublished `TrainerProfile` imports (`status: draft`, `createdSource: import`). They do not go into `src/routes/trainers.$slug.tsx`.

The name and the description are decided in sequential thinking, then checked by `scripts/save-draft.ts`. The script does not invent a given name from the header layout or the handle.

| Draft field | Filled from | Leave empty when |
| --- | --- | --- |
| `slug` | The Instagram handle, lowercase, including dots and underscores. It is the account id, the nick, and `/trainers/{slug}`. It is unique across drafts and profiles. The same handle updates the same card. Another profile with that nick is rejected. The same given name and surname on a different handle is the same person: the save is rejected and the existing slug is reported. A given name without a surname does not match other cards. The nick is not edited in the product; support changes it | The handle is empty |
| `firstName`, `lastName` | A verbatim quote in the profile, a pinned caption, Threads, or the operator note. One name in the note replaces a different name on the page | No name is written, or two given names conflict and the note does not pick one |
| `gender` | `male` or `female`, set by `save-draft.ts` from the given name. A name ending in а, я, or Latin a is female, except a short list of male names such as Никита and Илья. A name ending in a consonant is male. `тренерка`, `инструкторка`, or `спортсменка` in the source forces female. Staff see «женский» or «мужской» on the trainer card. The public page and the trainer profile do not show the field. The claim greeting uses it only to choose «был» or «была» | The given name is missing or ambiguous (Саша, Женя) |
| `sourceBio` | Verbatim profile biography. Staff see it as «Текст из источника». A phone in it is removed | The profile has no biography |
| `sourceAbout` | Verbatim frames of the highlight titled «Обо мне», «О себе», «About», or «About me» | No such highlight |
| `bio` | Card text «Как меня представить»: 1–4 sentences a person can read aloud, written from the biography, the about highlight, Threads, and the operator note. See Card text | Those sources have no words |
| `about` | Card text «Как проходят мои тренировки»: up to 3 short paragraphs from the same sources. This is the public block «О занятиях» | Those sources never say how a session goes. A pinned caption does not create this text |
| `photos` | Face photo first, then 2–3 gallery shots chosen by composition. Pinned posts come first, then other posts, then Threads frames that show the person more clearly. At most 9. Files: `{handle}.jpg`, then `{handle}-g2.jpg`, `{handle}-g3.jpg`, … | No image of at least 400px that shows the trainer, a session, or the gym |
| `certificates` | A pinned image kept as a document. Caption is a verbatim slice that contains «диплом», «сертификат», or «удостоверение». At most 5. File: `{handle}-d1.jpg` | The pin is not a document, or the caption does not use those words |
| `audiences` | `adult`, `kid`, `teen` in that order, only when the text says so (`взрослые`, `дети` / `ребёнок`, `подростки` / `юниоры`, or all ages). The draft stays empty when the profile does not say. A later sync treats an empty list as adults | Not stated |
| `headline` | `Тренер по {titleGenitive}` after a taxonomy match | No sport matched |
| `sports`, `primarySport` | Taxonomy phrases inside `sportQuotes` | No sport phrase |
| `city` | The single Belarus settlement in the operator note, when the note names one. Otherwise the single settlement in the profile, the about highlight, pinned captions, and Threads | The note names several cities, or no note and zero or several cities. Leave `resolved.city` empty. When none are named and `address` is empty, the script stores Минск. Do not write that default into the card text |
| `address` | The street or hall line from the biography, the about highlight, a pinned caption, Threads, or the operator note. Stored as printed. Not geocoded during import | No street or hall is named |
| `priceFrom` | A number next to BYN or руб | No price in the text |
| `languages` | A named language (`русский`, `беларуская`, `английский`, `польский`). The country name `Беларуси` is not the language | Not mentioned |
| `experienceYears` | Coaching experience only: `тренерский стаж N лет`, `стаж работы тренером N лет`, `опыт тренерской работы N лет`, or `тренирую N лет`. A bare `стаж N лет` is not this field and does not go on the card | The text does not say the years are coaching |
| `formats` | `персональные` / `индивидуальные` and `групповые` when those words are in the text | Not stated |
| `avatarPath` | The face file, also `photos[0]` when it exists. Playwright takes the largest file the page loaded for that same profile picture. The URL is not rewritten. A thumbnail is stored only when it is that largest file and no face of at least 400px is already saved. A new file of at least 400px replaces a saved face even when it has fewer pixels. A logo or a crop that cuts the face off is replaced by a clear portrait from a post | That URL is missing and no saved file of at least 400px exists yet |
| `contacts.phone` | The Belarus mobile in the operator note, when the note states one. Otherwise the mobile printed in the biography, the highlight, a pinned caption, Threads, or a `tel:` button. Stored as `+375 29 123-45-67`. Those digits are removed from the biography, the highlight, and the card text. No SMS and no confirmed mark | Not shown |
| `contacts.email` | An email in the operator note, when the note states one. Otherwise an email in the text, on Threads, or on a `mailto:` button. Stored on the card. No confirmation letter | Not shown |
| `contacts.telegram` | A Telegram link in the operator note, when the note states one. Otherwise a `t.me` link, or `@name` on a line that says Telegram, including Threads. Stored on the card. No bot confirmation | Not shown |
| `contacts.website` | The profile external link, except Instagram, Threads, and Telegram | None |

## Name

`firstName` and `lastName` stay separate in the draft, the database, and the cabinet form. `fullName` is only those two joined. Public cards, the profile title, similar trainers, and the admin table show the given name on one line and the surname on the next.

The given name is whatever the profile, a pinned caption, Threads, or the operator note actually writes. A header that shows only a surname is not a reason to leave `firstName` empty when a pin, Threads, or the note writes the given name beside that surname. When the note states one given name, that name is saved even if the page shows a different one. A handle is the file id, not a name. Role words (`тренер`, `coach`, `trainer`, `training`) are not given names.

## Description

The source stays verbatim. The card does not.

`sourceBio` is the profile biography. `sourceAbout` is the about-highlight frames. `pinned[].caption` is the pinned caption. `sourceThreads` is the Threads biography and the posts that were read. `operatorNotes` is the fact list the operator wrote for this account. A phone number is removed from those texts and stored only in `contacts.phone`, unconfirmed. Unpinned Instagram posts are not a source.

A pinned caption is read for fields: sport, experience, audience, address, city, phone, price, email, Telegram, language, and format. It is not a source for `bio` or `about`. Threads and the operator note are sources for both the fields and the card text.

`bio` and `about` are new sentences for the cabinet. Write them in Russian, in the first person, the way the trainer would speak on the card. Complete sentences. One fact each. Read the paragraph aloud: if it sounds like a form, a slogan, or a caption, rewrite it. No emoji, hashtags, links, @names, «директ», «подпишись», or «пишите». No HTML. No labels joined by a line break or a pipe (`Кикбоксинг | Минск | дети`). Do not paste the biography, a caption, or a Threads post. Do not retell a pinned caption. Do not add a city, price, year, result, or sport that the biography, the highlight, Threads, and the note do not state.

«Как меня представить» (`bio`) is what a person reads first:

1. Who this is and which sport they coach. Name the city when the biography, the highlight, Threads, or the note names it. A Minsk default is not named. A city that appears only in a pinned caption stays in the field and stays out of this text.
2. Who they work with, or the level, when one of those sources says it.
3. One more fact from those sources (format or experience), when it exists.

One to four sentences. At most 700 characters. Fewer sentences when the source is thin. Do not pad. A practiced sport may appear only as something they do themselves, never as the sport they coach.

«Как проходят мои тренировки» (`about`) answers how a session goes when the biography, the about highlight, Threads, or the note says so. Up to three paragraphs, separated by a blank line, at most 1600 characters and 8 sentences. Leave it empty when those sources never mention a session, a warm-up, sparring, or an individual or group format. When the operator asks to use the biography lines themselves, write those lines as spoken sentences and quote them verbatim. A pin that does mention them fills `formats`, `audiences`, or `address` and leaves this text empty. Do not turn a list of sports into a fake session.

Each card text carries `presentationQuotes` or `trainingQuotes`: verbatim slices of the biography, the about highlight, Threads, or the operator note. A number in the card text must already appear there. A street named in a pin is `address`, not a sentence in this text.

Sample, not data. Biography: `Владимир. Минск. Кикбоксинг и бокс. ОФП для любого уровня`. Card: `Я Владимир, тренер по кикбоксингу и боксу в Минске. Веду ОФП для любого уровня.` A pin that says `Групповые тренировки для детей, пр. Пушкина, 68А` sets `formats` to group, `audiences` to kid, and `address` to that street. Training stays empty. A note that says `Анна Козлова, Брест` fills the name and the city when the profile states neither, and the card names Брест.

## Photo search

Photo search runs for every trainer, including a profile with no pins.

The face photo is the profile picture when that picture shows the person. Rules for its URL are in the skill. It is `photos[0]`. CDN copies of that one picture keep the largest file the page loaded. A different picture is not chosen because it is larger.

Then judge images from the pinned posts, at most three posts and at most two images stored per post. Read each pinned caption into the profile fields listed above. After that, other posts on the grid may add photos until the gallery holds two or three images. Threads frames from the posts that were read compete for those same slots. Their Instagram captions stay off the card and out of the fields. Both sides at least 400px. That floor rejects a thumbnail. It does not rank the frames. The same file as the face is a duplicate, not a second photo.

Keep a gallery photo when it shows this trainer, a session, the gym, or the class, and a person can see who it is without squinting. Prefer an unobstructed face, then a readable action, then the room with the trainer in it. Skip a text card, a quote image, a logo, a flyer, another person's portrait, a crop that cuts the face, a collage, a crowd where the trainer cannot be picked out, a back-of-head shot when a clearer frame exists, and a blur. Skip reasons: `text`, `logo`, `flyer`, `duplicate`, `not-trainer`, `crop`, `clutter`, `crowd`, `back`, `blur`. One clear frame beats three weak ones. List the strongest gallery frame first. When no still clears that bar, keep the still photos the profile has, including a back view or a crop, so the card is not left without a picture. Do not keep a video, a reel, or a story. A carousel photo is a photo.

Keep a certificate only when the picture is a document and the pinned caption contains «диплом», «сертификат», or «удостоверение». The caption stored on the document is a verbatim slice of that post, at most 80 characters, and it contains one of those words. A diploma does not also sit in the gallery.

Every stored pinned image is either kept or skipped. At most 8 gallery photos besides the face, and at most 5 certificates.

Addresses are not geocoded during import. A gym or street named in the biography, the about highlight, a pinned caption, Threads, or the operator note is stored in `address`. It is not written into the training text unless the biography, the highlight, Threads, or the note also describes the session.

## Sport

`sportQuotes` lists every taxonomy phrase in the biography, the about highlight, the pinned captions, Threads, and the operator note. Sequential thinking marks each phrase `coached` or `practiced`.

A phrase is coached only when the same clause says the person teaches or leads it. A phrase is practiced when the clause says they do it themselves. A phrase is unrelated when the same letters are not the sport, such as «борьба с РПП». The headline and `sports` use coached phrases only. The longest alias does not win: hiking in «хожу в походы» stays practiced even when that alias is longer than ОФК.

`бокс` does not match inside `кикбоксинг`. `тайским боксом` is тайский бокс, not бокс. `тренажёрный` and `тренажерный` are the same phrase. The words `тренер` and `тренировки` are not sports unless a taxonomy alias contains them. `тренируюсь` is the person training, not coaching.

## Files

- Raw extract plus `resolved`: `data/instagram-trainers/_raw/{handle}.json`
- Draft: `data/instagram-trainers/{handle}.json`
- Batch index: `data/instagram-trainers/index.json`
- Avatar: `public/trainers/instagram/{handle}.jpg`
