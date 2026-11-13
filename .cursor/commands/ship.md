# Ship

Commit the current feature work and refresh the local architecture note. Update the live site only when this command includes `deploy` or `деплой`.

## Project context

- Follow `.cursor/skills/trenio-ship/SKILL.md` for the whole run.
- The note is `docs/ARCHITECTURE.local.md`. It stays untracked.
- A deploy reads `.cursor/skills/trenio-vps/SKILL.md` and `.cursor/rules/trenio-deploy.mdc`. Do not print a password, a database URL, or the server host.

## Arguments

- `/ship` — update the note, then commit. Do not push. Do not touch the server.
- `/ship deploy` — the same, then push `main` and update https://trenio.by. The Russian word `деплой` is the same argument.

## Do this now

1. Read the skill.
2. Update `docs/ARCHITECTURE.local.md` before the first commit: correct what the diff made false, append what is new.
3. Commit one coherent feature per commit.
4. Deploy only when the argument is present, and only after the commits succeeded.

## Result

- The architecture note matches the code that was just committed, and it is still gitignored.
- Each feature is its own commit. Secrets and the local note are not in any commit.
- Without `deploy`, `main` on the server is unchanged.
- With `deploy`, the standby answered before the service restarted, and the public site answers 200. A standby that never answered left the running service in place.