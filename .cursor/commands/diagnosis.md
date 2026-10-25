# Diagnosis

Find the failing action from `app_logs` and name the code to change.

## Do this now

1. Read `.cursor/skills/trenio-diagnosis/SKILL.md`.
2. Take the email, user id, route, or error from the request. If none was given, start with `--level error --hours 24`.
3. Run `npm run logs:diagnose` with those flags. Read the JSON. Open the file mapped from the action.
4. Answer in Russian using the skill's report shape: what broke, the row that proves it, the file, and the change.
5. Do not paste secrets, message bodies, or reset links. Do not run `db:push`.
