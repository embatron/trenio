// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

import { serveUploadFiles } from "./src/vite/serve-upload-files";


export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    ssr: {
      external: ["ip-location-api", "sharp"],
    },
    plugins: [serveUploadFiles()],
    server: {
      // Public URL is http://trenio.local when Apache on :80 proxies to this server.
      // Set VITE_DEV_ORIGIN when Apache is not in front (it listens on :8080 here).
      allowedHosts: ["trenio.local", "localhost", "127.0.0.1"],
      ...(process.env.VITE_DEV_ORIGIN
        ? { origin: process.env.VITE_DEV_ORIGIN }
        : {
            origin: "http://trenio.local",
            ws: {
              host: "trenio.local",
              protocol: "ws" as const,
              clientPort: 80,
            },
          }),
    },
  },
});
