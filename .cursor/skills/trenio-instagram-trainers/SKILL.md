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
- Copy description text from the profile bio and the pinned captions. Do not paraphrase it.

## Do not

- Call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API. The source is the public profile page.
- Ask for, type, or store an Instagram password.
- Save an `s100`, `s150`, or `s206` thumbnail as the face photo, or edit a thumbnail URL (delete `stp`, or replace `s150` with `s1080`).
- Read Instagram from any browser profile except the import profile named below.
- Choose a given name from the handle, from a previous trainer, or from an example in this skill.
- Leave the given name empty when the profile or a pinned caption writes that name next to the surname.
- Save when two different given names are written for the same surname.
- Treat the latest posts as pinned when no pin mark is visible. Open at most three pinned posts.
- Write the draft into `src/routes/trainers.$slug.tsx`.

Wrong: the header shows only a surname, so the given name is left empty even though a pinned caption states it.
Wrong: two pinned captions use two different given names, and one of them is picked.
Right: one given name is written next to the surname in the profile or in a pinned caption, and that exact name is saved. The caption text is copied into `about`.

## Flow

```
Import progress:
- [ ] Normalize the URL list
- [ ] For each profile: read header, face photo, pinned links
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

Pass `.cursor/skills/trenio-instagram-trainers/scripts/extract-profile.fn.js` as `function` to `browser_evaluate`. `pinnedPosts` lists only tiles with a pin mark, at most three. If the snapshot shows a pin and `pinnedPosts` is empty, evaluate once more. If it is still empty, continue with no pinned posts. Do not open unpinned posts.

### Face photo

Use only this browser and this account:

- Chrome user data dir: `/home/embatron/.cache/trenio-instagram-login`
- Instagram account signed in there: `embratron.eth`

Do not use the everyday Chrome profile and do not copy its cookies. Do not type or store the password. If that window shows a login wall, stop and ask the user to sign in once there.

The face photo is the profile-picture image whose alt is `{handle}'s profile picture`.

1. Read the image id from that `src` filename, such as `613680184_18558822421030230_3263310295088186577_n.jpg`.
2. While the signed-in profile page loads, read the responses the page itself makes, including `/api/graphql`. Do not call `web_profile_info`, the Graph API, or any request you build yourself.
3. From those responses, keep URLs whose path contains that same image id. Download the URL that has no `stp` parameter. That is the source file.
4. Keep the file only when both sides are at least 400px.
5. If that URL is missing, leave the photo empty.

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
6. Set `bio` to a verbatim slice of the profile text. Set `about` to the pinned captions in pin order, one string each, copied without changes.
7. Sport, city, price, phone, languages. Every value is a phrase that appears in the quotes from thoughts 1–2. Map sport phrases to `src/lib/catalog/sport-taxonomy.ts`.
8. Write the `resolved` object. Set `nextThoughtNeeded` to false only on this thought.

`resolved` shape:

```json
{
  "firstName": "",
  "lastName": "",
  "nameQuotes": [],
  "bio": "",
  "about": [],
  "sportQuotes": [],
  "city": "",
  "priceFrom": null,
  "phone": "",
  "languages": []
}
```

`nameQuotes` are verbatim slices that contain the saved name parts. `sportQuotes` are verbatim slices that contain every sport phrase from the profile and the pins. `about.length` equals the number of pinned posts.

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
