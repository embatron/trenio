# Import Instagram trainers

Read public Instagram profiles into Trenio draft trainer records. One link or a bulk list.

## Project context

- Follow `.cursor/skills/trenio-instagram-trainers/SKILL.md` for the whole run.
- Field rules and output paths are in `.cursor/skills/trenio-instagram-trainers/fields.md`.
- Read the public profile in the `user-playwright` MCP. Do not call the Instagram Graph API, Business Discovery, `web_profile_info`, or a private API.
- Do not ask for, type, or store an Instagram password.
- Drafts land in `data/instagram-trainers/`. They stay unpublished.

## Input

The rest of the user message is the source list. Accept profile URLs and bare handles. A bare handle becomes `https://www.instagram.com/{handle}/`.

Example:

```
/import-instagram-trainers
https://www.instagram.com/antipenko.training/
https://www.instagram.com/another.coach/
```

## Do this now

1. Read the skill, `scripts/extract-profile.fn.js`, and `scripts/extract-post.fn.js`.
2. Normalize every link. Reject post, reel, and story URLs as the source list.
3. For one profile at a time: open it, snapshot, extract the header and the pinned-post links.
4. Save the face photo by the rule in the skill section "Face photo". Use only the import Chrome profile and the account named there.
5. Open each pinned post, up to three, and copy its caption. Do not open unpinned posts.
6. Run eight `sequentialthinking` steps for that trainer. Decide the given name only from the profile and those captions.
7. Write `resolved` into `data/instagram-trainers/_raw/{handle}.json` and run `save-draft.ts` for that file. Fix a rejection by revising the thought, not by editing the draft.
8. On a login wall, stop and ask the user to sign in once in the import Chrome window from the skill. Do not type the password. On a checkpoint, stop the batch.
9. Report each profile: name, sport, city, pinned count, photo side in pixels, and fields still empty.
10. Close the Playwright page.

## Result

- Saved drafts are listed with their file paths.
- Empty fields stay empty.
- The public trainer pages are unchanged until a later catalog import.
