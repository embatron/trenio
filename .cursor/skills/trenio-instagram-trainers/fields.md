# Instagram draft fields

Drafts are unpublished `TrainerProfile` imports (`status: draft`, `createdSource: import`). They do not go into `src/routes/trainers.$slug.tsx`.

The name and the description are decided in sequential thinking, then checked by `scripts/save-draft.ts`. The script does not invent a given name from the header layout or the handle.

| Draft field | Filled from | Leave empty when |
| --- | --- | --- |
| `firstName`, `lastName` | A verbatim quote in the profile or a pinned caption | No name is written, or two given names conflict |
| `bio` | Verbatim slice of the profile bio | The profile has no bio |
| `about` | Verbatim captions of the pinned posts, one per post, at most 3 | No pinned posts |
| `headline` | `Тренер по {titleGenitive}` after a taxonomy match | No sport matched |
| `sports`, `primarySport` | Taxonomy phrases inside `sportQuotes` | No sport phrase |
| `city` | The single Belarus settlement in the profile and pins | Zero or several cities |
| `priceFrom` | A number next to BYN or руб | No price in the text |
| `languages` | Named languages in the text | Not mentioned |
| `avatarPath` | Source file of the profile picture: same image id, no `stp`, from the signed-in import account in the skill. Both sides at least 400px | That URL is missing, or the file is still a thumbnail |
| `contacts.phone` | A `+375` number in the text | Not shown |
| `contacts.website` | The profile external link | None |

## Name

The given name is whatever the profile or a pinned caption actually writes. A header that shows only a surname is not a reason to leave `firstName` empty when a pin writes the given name beside that surname. A handle is the file id, not a name. Role words (`тренер`, `coach`, `trainer`, `training`) are not given names.

## Description

`bio` is profile text. `about` is the pinned captions in order. Both are copied, not summarized. Unpinned posts are not a source.

## Sport

`sportQuotes` must include every taxonomy label or alias that appears in the profile or the pinned captions. The longest child alias is `primarySport`. The words `тренер` and `тренировки` are not sports unless a taxonomy alias contains them.

## Files

- Raw extract plus `resolved`: `data/instagram-trainers/_raw/{handle}.json`
- Draft: `data/instagram-trainers/{handle}.json`
- Batch index: `data/instagram-trainers/index.json`
- Avatar: `public/trainers/instagram/{handle}.jpg`
