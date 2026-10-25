# Instagram draft fields

Drafts are unpublished `TrainerProfile` imports (`status: draft`, `createdSource: import`). They do not go into `src/routes/trainers.$slug.tsx`.

The name and the description are decided in sequential thinking, then checked by `scripts/save-draft.ts`. The script does not invent a given name from the header layout or the handle.

| Draft field | Filled from | Leave empty when |
| --- | --- | --- |
| `slug` | The Instagram handle, lowercase, including dots and underscores. It is also the account nick and `/trainers/{slug}`. It must be unique across drafts and profiles. The same handle updates the same draft. Another profile with that nick is rejected. The nick is not edited in the product; support changes it | The handle is empty |
| `firstName`, `lastName` | A verbatim quote in the profile or a pinned caption | No name is written, or two given names conflict |
| `gender` | `male` or `female`, set by `save-draft.ts` from the given name. A name ending in а, я, or Latin a is female, except a short list of male names such as Никита and Илья. A name ending in a consonant is male. `тренерка`, `инструкторка`, or `спортсменка` in the source forces female. Staff see «женский» or «мужской» on the trainer card. The public page and the trainer profile do not show the field. The claim greeting uses it only to choose «был» or «была» | The given name is missing or ambiguous (Саша, Женя) |
| `bio` | Verbatim slice of the profile biography. This is the card field «О себе» | The profile has no biography |
| `about` | Verbatim frames of the highlight titled «Обо мне», «О себе», «About», or «About me», then the pinned captions | No about highlight and no pinned posts |
| `headline` | `Тренер по {titleGenitive}` after a taxonomy match | No sport matched |
| `sports`, `primarySport` | Taxonomy phrases inside `sportQuotes` | No sport phrase |
| `city` | The single Belarus settlement in the profile and pins | Zero or several cities |
| `priceFrom` | A number next to BYN or руб | No price in the text |
| `languages` | A named language (`русский`, `беларуская`, `английский`, `польский`). The country name `Беларуси` is not the language | Not mentioned |
| `experienceYears` | `стаж N лет` or `более N лет` | Not stated |
| `formats` | `персональные` / `индивидуальные` and `групповые` when those words are in the text | Not stated |
| `avatarPath` | `public/trainers/instagram/{handle}.jpg`, the source profile picture (same image id, no `stp`, both sides at least 400px) plus the sized files beside it. A later import keeps this file when the new read has no source of at least 400px | That URL is missing and no saved file of at least 400px exists yet |
| `contacts.phone` | A Belarus mobile in the text or on a `tel:` button. Stored only here, as `+375 33 637-62-68`. The same digits are removed from `bio` and `about`. No SMS confirmation | Not shown |
| `contacts.email` | An email in the text or on a `mailto:` button. Stored on the card. No confirmation letter | Not shown |
| `contacts.telegram` | A `t.me` link, or `@name` on a line that says Telegram. Stored on the card. No bot confirmation | Not shown |
| `contacts.website` | The profile external link, except Instagram, Threads, and Telegram | None |

## Name

`firstName` and `lastName` stay separate in the draft, the database, and the cabinet form. `fullName` is only those two joined. Public cards, the profile title, similar trainers, and the admin table show the given name on one line and the surname on the next.

The given name is whatever the profile or a pinned caption actually writes. A header that shows only a surname is not a reason to leave `firstName` empty when a pin writes the given name beside that surname. A handle is the file id, not a name. Role words (`тренер`, `coach`, `trainer`, `training`) are not given names.

## Description

`bio` is profile text. `about` is the about-highlight frames, then the pinned captions. Both are copied, not summarized. A phone number in either text is removed and stored only in `contacts.phone` as `+375 33 637-62-68`. Unpinned posts are not a source.

## Sport

`sportQuotes` lists every taxonomy phrase in the biography, the about highlight, and the pinned captions. Sequential thinking marks each phrase `coached` or `practiced`.

A phrase is coached only when the same clause says the person teaches or leads it. A phrase is practiced when the clause says they do it themselves. A phrase is unrelated when the same letters are not the sport, such as «борьба с РПП». The headline and `sports` use coached phrases only. The longest alias does not win: hiking in «хожу в походы» stays practiced even when that alias is longer than ОФК.

`бокс` does not match inside `кикбоксинг`. `тайским боксом` is тайский бокс, not бокс. `тренажёрный` and `тренажерный` are the same phrase. The words `тренер` and `тренировки` are not sports unless a taxonomy alias contains them. `тренируюсь` is the person training, not coaching.

## Files

- Raw extract plus `resolved`: `data/instagram-trainers/_raw/{handle}.json`
- Draft: `data/instagram-trainers/{handle}.json`
- Batch index: `data/instagram-trainers/index.json`
- Avatar: `public/trainers/instagram/{handle}.jpg`
