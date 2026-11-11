import path from "node:path";
import { fileURLToPath } from "node:url";

import wsAdapter from "crossws/adapters/node";
import type { Plugin } from "vite";

const HOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../lib/messages/live-socket.ts");

// Nitro's websocket route is built for production. The dev server is Vite, so
// the same hooks answer /messages/live here and leave the HMR socket alone.
export function messageLiveDev(): Plugin {
  return {
    name: "trenio-message-live",
    apply: "serve",
    configureServer(server) {
      const { handleUpgrade } = wsAdapter({
        resolve: async (request) => {
          if (new URL(request.url).pathname !== "/messages/live") return {};
          const loaded = (await server.ssrLoadModule(HOOKS)) as { messageLiveHooks?: object };
          return loaded.messageLiveHooks ?? {};
        },
      });
      server.httpServer?.on("upgrade", (req, socket, head) => {
        const protocol = req.headers["sec-websocket-protocol"];
        if (typeof protocol === "string" && protocol.startsWith("vite-")) return;
        const pathname = (req.url ?? "").split("?")[0];
        if (pathname !== "/messages/live") return;
        void handleUpgrade(req, socket, head);
      });
    },
  };
}
