# Refresh the local cache

Clear Vite's cache, start the Trenio dev server again, and confirm `http://trenio.local` serves the current stylesheet and a client that actually runs.

Styles have no separate build. Tailwind compiles `src/styles.css` inside Vite. Deleting `node_modules/.vite` and starting the server again is the rebuild.

## Do not

- Stop Apache, or restart the other vhosts on that Apache.
- Bind Vite to port 80 or 8080. Vite stays on 8081. See `.cursor/rules/local-dev.mdc`.
- Print `.env` or `DATABASE_URL`.
- Commit, unless the user asked for a commit in the same message.

## Do this now

1. Find the process listening on 8081. Stop it only when the command line is this repo's `vite dev`. If 8081 belongs to something else, stop and say so.
2. Delete `node_modules/.vite`.
3. From the repo root, start `npm run dev` and leave it running. Use Node 22 or newer. If `npm` is not on `PATH`, prepend `$HOME/.nvm/versions/node/v24.13.0/bin`.
4. Wait until the log prints `Local:`. `http://trenio.local/` must return 200, and the title must contain «Найти тренера».
5. Request `http://trenio.local/src/styles.css`. It must return 200 with `Cache-Control: no-cache`. The body must contain the Tailwind banner and a selector that is in `src/styles.css` now (use `.trainer-card__name`). An empty body or a stylesheet that lacks that selector means the cache is still stale: stop and say so.
6. Walk the client module graph from `http://127.0.0.1:8081/src/router.tsx`. Follow static `from "..."` imports. Skip `node_modules`, except to notice `postgres`. The walk must not reach `postgres` or `/src/db/index.ts`.
   - A pure helper that a route imports must not share a file with `getDb()`. Database writes belong in a `*.server.ts` file that the client route graph does not import.
   - If the walk hits the database, split that file, then repeat from step 1. `ReferenceError: Buffer is not defined` in `postgres/src/bytes.js` is this leak. The page then keeps the server HTML, and the header never receives `is-scrolled`.
7. Open `http://trenio.local/` in the browser. After the page hydrates, scroll the window. `#site-header` must gain `is-scrolled`, and its computed `background-color` must be white (`rgb(255, 255, 255)`). At scroll 0 the background stays transparent. That rule is the inline style `style[data-trenio-chrome]` from `src/components/site-chrome.tsx`. It is not in `src/styles.css`.
8. Read the Vite log. A client `Buffer is not defined` or `routesById` means the check failed.

## Result

Report in the user's language: the server is up, the stylesheet is current, the client graph does not load Postgres, and the header turns white on scroll. If a step failed, name the step and the import chain. Tell the user to reload their own tab with a cache bypass once (Cmd+Shift+R). That tab can still hold the previous bundle.
