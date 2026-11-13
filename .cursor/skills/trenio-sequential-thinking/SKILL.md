---
name: trenio-sequential-thinking
description: >-
  Runs the sequential-thinking MCP before a large multi-step Trenio action and
  before analysis or diagnosis. Use for a feature that spans several steps,
  a cross-module bug, a design, a deploy plan, a failure report, /diagnosis,
  or any task whose scope is not clear yet. Skip a one-line edit.
---

# Sequential thinking

Purpose: a long action and a diagnosis get an ordered pass before the first edit or the first conclusion. The server is the Cursor MCP namespace `user-sequential-thinking`, tool `sequentialthinking`. This skill does not govern product files.

## When

Run one chain before acting when the task is any of these:

- several steps, several files, or a scope that is still unclear
- analysis, a cross-module bug, a design, or a deploy plan
- a failure report or `/diagnosis`

Skip a one-line change, a rename, or a question one file already answers. An Instagram import keeps the eleven thoughts in `trenio-instagram-trainers` and does not start a second chain.

## Connect

1. `GetDynamicTools` with namespace `user-sequential-thinking`. Read the schema before the first call in the session.
2. If `namespaceStatus` is `needsAuth`, call `mcp_auth` with empty arguments, inspect the namespace again, then retry.
3. Call `sequentialthinking`. Required fields are `thought`, `thoughtNumber`, `totalThoughts`, and `nextThoughtNeeded`.

If the namespace is `error`, `loading`, or missing, write the same numbered passes in working notes and say the server was unavailable. Do not ship the conclusion from one glance.

## Passes

Set `totalThoughts` to at least 5. Raise it when the task is larger. `thoughtNumber` may pass the estimate. Set `nextThoughtNeeded` to false only on the last thought, when the decision is checked.

1. What was asked, and what done looks like.
2. What the files, the journal, or the page already show. Mark every remaining guess.
3. The order of work. Name the step that is wrong if a guess in thought 2 is wrong.
4. One hypothesis, checked against the evidence named in thought 2.
5. Revise when the evidence disagrees (`isRevision: true`, `revisesThought` set). Then state the decision.

Use `branchFromThought` and `branchId` when two designs stay open. Drop a branch that the evidence does not support.

Diagnosis still follows `trenio-diagnosis`. The chain orders the reading. The `app_logs` row stays the source. Do not name a cause the row does not support.

## Do not

- Paste the thought log into the reply. The reply is the decision and the evidence.
- Repeat a password, a token, a reset link, or a message body inside a thought.
- Edit the product while `nextThoughtNeeded` is still true.
- Call a hosted stand-in. This project uses `user-sequential-thinking` only.

## Example

```json
{
  "thought": "The phone dialog flashes the footer. The sheet animation starts off-screen, so the page underneath shows for one frame. Next: confirm that rule in the workspace CSS, then cover the page before the fade.",
  "thoughtNumber": 4,
  "totalThoughts": 5,
  "nextThoughtNeeded": true
}
```
