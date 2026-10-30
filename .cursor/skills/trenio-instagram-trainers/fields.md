# Instagram draft fields

Drafts are unpublished `TrainerProfile` imports (`status: draft`, `createdSource: import`). They do not go into `src/routes/trainers.$slug.tsx`.

The name and the description are decided in sequential thinking, then checked by `scripts/save-draft.ts`. The script does not invent a given name from the header layout or the handle.

| Draft field | Filled from | Leave empty when |
| --- | --- | --- |
| `slug` | The Instagram handle, lowercase, including dots and underscores. It is also the account nick and `/trainers/{slug}`. It must be unique across drafts and profiles. The same handle updates the same draft. Another profile with that nick is rejected. The nick is not edited in the product; support changes it | The handle is empty |
| `firstName`, `lastName` | A verbatim quote in the profile or a pinned caption | No name is written, or two given names conflict |
| `gender` | `male` or `female`, set by `save-draft.ts` from the given name. A name ending in а, я, or Latin a is female, except a short list of male names such as Никита and Илья. A name ending in a consonant is male. `тренерка`, `инструкторка`, or `спортсменка` in the source forces female. Staff see «женский» or «мужской» on the trainer card. The public page and the trainer profile do not show the field. The claim greeting uses it only to choose «был» or «была» | The given name is missing or ambiguous (Саша, Женя) |
| `sourceBio` | Verbatim profile biography. Staff see it as «Текст из источника». A phone in it is removed | The profile has no biography |
| `sourceAbout` | Verbatim frames of the highlight titled «Обо мне», «О себе», «About», or «About me» | No such highlight |
| `bio` | Card text «Как меня представить»: 1–4 short sentences written for reading. See Card text | The profile, highlight, and pins have no words |
| `about` | Card text «Как проходят мои тренировки»: up to 3 short paragraphs. This is the public block «О занятиях» | The source never says how a session goes |
| `photos` | Face photo first, then gallery shots from pinned posts. At most 9. Files: `{handle}.jpg`, then `{handle}-g2.jpg`, `{handle}-g3.jpg`, … | No image of at least 400px |
| `certificates` | A pinned image kept as a document. Caption is a verbatim slice that contains «диплом», «сертификат», or «удостоверение». At most 5. File: `{handle}-d1.jpg` | The pin is not a document, or the caption does not use those words |
| `audiences` | `adult`, `kid`, `teen` in that order, only when the text says so (`взрослые`, `дети` / `ребёнок`, `подростки` / `юниоры`, or all ages). The draft stays empty when the profile does not say. A later sync treats an empty list as adults | Not stated |
| `headline` | `Тренер по {titleGenitive}` after a taxonomy match | No sport matched |
| `sports`, `primarySport` | Taxonomy phrases inside `sportQuotes` | No sport phrase |
| `city` | The single Belarus settlement in the profile and pins | Zero or several cities |
| `priceFrom` | A number next to BYN or руб | No price in the text |
| `languages` | A named language (`русский`, `беларуская`, `английский`, `польский`). The country name `Беларуси` is not the language | Not mentioned |
| `experienceYears` | `стаж N лет` or `более N лет` | Not stated |
| `formats` | `персональные` / `индивидуальные` and `групповые` when those words are in the text | Not stated |
| `avatarPath` | The face file, also `photos[0]` when it exists. Source is the profile picture (same image id, no `stp`, both sides at least 400px) plus the sized files beside it. A later import keeps this file when the new read has no source of at least 400px. A pinned photo does not replace the face | That URL is missing and no saved file of at least 400px exists yet |
| `contacts.phone` | The Belarus mobile printed in the biography, the highlight, a pinned caption, or a `tel:` button. Stored as `+375 29 123-45-67`. Those digits are removed from the biography, the highlight, and the card text. No SMS and no confirmed mark | Not shown |
| `contacts.email` | An email in the text or on a `mailto:` button. Stored on the card. No confirmation letter | Not shown |
| `contacts.telegram` | A `t.me` link, or `@name` on a line that says Telegram. Stored on the card. No bot confirmation | Not shown |
| `contacts.website` | The profile external link, except Instagram, Threads, and Telegram | None |

## Name

`firstName` and `lastName` stay separate in the draft, the database, and the cabinet form. `fullName` is only those two joined. Public cards, the profile title, similar trainers, and the admin table show the given name on one line and the surname on the next.

The given name is whatever the profile or a pinned caption actually writes. A header that shows only a surname is not a reason to leave `firstName` empty when a pin writes the given name beside that surname. A handle is the file id, not a name. Role words (`тренер`, `coach`, `trainer`, `training`) are not given names.

## Description

The source stays verbatim. The card does not.

`sourceBio` is the profile biography. `sourceAbout` is the about-highlight frames. `pinned[].caption` is the pinned caption. A phone number is removed from those texts and stored only in `contacts.phone`, unconfirmed. Unpinned posts are not a source.

`bio` and `about` are new sentences for the cabinet. Write them in Russian, in the first person, the way the trainer would speak on the card. Short sentences. One fact each. No emoji, hashtags, links, @names, «директ», «подпишись», or «пишите». No HTML. Do not paste the biography or a caption. Do not add a city, price, year, result, or sport that the source does not state.

«Как меня представить» (`bio`) is what a person reads first:

1. Who this is and which sport they coach. Name the saved city in this text.
2. Who they work with, or the level, when the source says it.
3. One more fact from the source (format or experience), when it exists.

One to four sentences. At most 700 characters. Fewer sentences when the source is thin. Do not pad. A practiced sport may appear only as something they do themselves, never as the sport they coach.

«Как проходят мои тренировки» (`about`) answers how a session goes, where, in which format, and what is different. Use only the parts the source actually says. Up to three paragraphs, separated by a blank line, at most 1600 characters and 8 sentences. Leave it empty when the biography, the highlight, and the pins never mention a session, a gym, a warm-up, sparring, or an individual or group format. Do not turn a list of sports into a fake session.

Each card text carries `presentationQuotes` or `trainingQuotes`: verbatim slices from the source that the sentences rest on. A number in the card text must already appear in the source.

Sample, not data. Source: `Владимир. Минск. Кикбоксинг и бокс. ОФП для любого уровня`. Card: `Я Владимир, тренер по кикбоксингу и боксу в Минске. Веду ОФП для любого уровня.` Training stays empty: that source never says how a session goes. A pin that says `Тренировка в зале: разминка, техника, спарринг` becomes `Тренировка проходит в зале. Сначала разминка, затем техника и спарринг.`

## Photo search

Photo search runs for every trainer, including a profile with no pins.

The face photo is the profile picture. Rules for its URL are in the skill. It is `photos[0]`.

Then judge images from the pinned posts, at most three posts and at most two images stored per post. Both sides at least 400px. The same file as the face is a duplicate, not a second photo.

Keep a gallery photo when it shows this trainer, a session, the gym, or the class. Skip a text card, a quote image, a logo, a flyer, or another person's portrait. Skip reasons: `text`, `logo`, `flyer`, `duplicate`, `not-trainer`.

Keep a certificate only when the picture is a document and the pinned caption contains «диплом», «сертификат», or «удостоверение». The caption stored on the document is a verbatim slice of that post, at most 80 characters, and it contains one of those words. A diploma does not also sit in the gallery.

Every stored pinned image is either kept or skipped. At most 8 gallery photos besides the face, and at most 5 certificates.

Addresses are not geocoded during import. A gym or street named in the source goes into the training text, not into a map pin.

## Sport

`sportQuotes` lists every taxonomy phrase in the biography, the about highlight, and the pinned captions. Sequential thinking marks each phrase `coached` or `practiced`.

A phrase is coached only when the same clause says the person teaches or leads it. A phrase is practiced when the clause says they do it themselves. A phrase is unrelated when the same letters are not the sport, such as «борьба с РПП». The headline and `sports` use coached phrases only. The longest alias does not win: hiking in «хожу в походы» stays practiced even when that alias is longer than ОФК.

`бокс` does not match inside `кикбоксинг`. `тайским боксом` is тайский бокс, not бокс. `тренажёрный` and `тренажерный` are the same phrase. The words `тренер` and `тренировки` are not sports unless a taxonomy alias contains them. `тренируюсь` is the person training, not coaching.

## Files

- Raw extract plus `resolved`: `data/instagram-trainers/_raw/{handle}.json`
- Draft: `data/instagram-trainers/{handle}.json`
- Batch index: `data/instagram-trainers/index.json`
- Avatar: `public/trainers/instagram/{handle}.jpg`
