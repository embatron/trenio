---
name: trenio-ship
description: >-
  Commits the current Trenio.by feature work, rewrites the local architecture
  note to match it, and deploys to trenio.by only when the command includes
  deploy. Use when the user runs /ship or /ship deploy.
---

# Ship

Project command only. `/ship` commits finished work on this laptop. `/ship deploy` (the word `deploy` or `деплой` anywhere in that command) also pushes `main` and updates the live site. Any other words are not a deploy.

## Order

Do these in order. Do not push or restart the live site before the commits exist.

1. See the work. In parallel: `git status`, `git diff` (staged and unstaged), `git log -8 --oneline`.
2. Update `docs/ARCHITECTURE.local.md` before any commit. Rules are below.
3. Sync the tracked Russian docs when the diff changes a route, role, schema, env, or architecture. Follow `.cursor/skills/trenio-docs-sync/SKILL.md`.
4. Commit the feature work. One commit per coherent feature. A fix that belongs to that feature stays in the same commit.
5. Stop, unless the command included `deploy` or `деплой`.
6. Deploy only after every commit succeeded. Read `.cursor/skills/trenio-vps/SKILL.md` and follow its release steps. The standby order is the same one in `.cursor/rules/trenio-deploy.mdc`.

## Architecture note

`docs/ARCHITECTURE.local.md` is the local map of the product. It is gitignored. Refresh it on every `/ship`, including a ship that then deploys.

- Write it in Russian. Keep the existing sections. Do not rewrite the file from scratch.
- Correct a sentence that the diff made false. Append a paragraph or subsection for behavior that has no section yet.
- Change the date in the first lines to today.
- If the diff does not change product behavior, say so in the reply and leave the note untouched. Do not add filler.
- Never stage this file. `git check-ignore docs/ARCHITECTURE.local.md` must still match it.
- Do not put a password, `DATABASE_URL`, `SYNC_TOKEN`, a short-link code, or the production host and listen ports into the note.

## Commits

The `/ship` command is the request to commit. Do not commit on any other turn.

- Never update git config. Never skip hooks. Never use `git commit --amend` unless the user asked for amend in this command and the amend rules in the user rules all hold.
- Never force-push. Never push from the server.
- Stage only files that belong to the feature. Leave unrelated dirt unstaged and say so.
- Do not commit secrets or local-only files: `.env`, `docs/ARCHITECTURE.local.md`, `.cursor/skills/trenio-vps/`, `.cursor/rules/trenio-vps.mdc`, `.cursor/skills/trenio-instagram-trainers/LOGIN.md`, `.cursor/rules/instagram-login.mdc`, `data/geoip/`, `data/message-files/`, `public/avatars/`, `public/trainers/self/`, `public/trainers/admin/`.
- Message via HEREDOC. One or two sentences, the why, matching recent `git log` style.
- If the hook rejects the commit, fix the cause and make a new commit. Do not amend a rejected commit.
- If there is nothing to commit, do not create an empty commit.

## Deploy

Skip this whole section when the command has no `deploy` and no `деплой`.

- The branch must be `main`. If it is not, do not push and do not restart the service. Say which branch is checked out.
- Push from the laptop only:

```bash
git push git@EAKull:embatron/trenio.git HEAD:main
```

- If the push fails, stop. Do not deploy a commit that is not on `main`.
- On the server, follow the VPS skill: pull with `--ff-only`, build while the current process keeps answering, start the standby, wait until it returns 200, restart the service, wait until the main port returns 200, then stop the standby.
- If the standby never answers, stop the standby and leave the service as it is.
- Do not restart the other sites on that machine. Do not print `.env` or the root password. Do not print the host or the listen ports in the reply; say whether `https://trenio.by` returned 200.

## Reply

List each new commit subject. Say what changed in the architecture note, or that it was already current. Say whether the live site was updated. A ship without `deploy` ends with the commits still local.