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
  // The VPS runs the same Nitro node server as the other sites. Without this,
  // the Lovable helper builds a Cloudflare worker.
  nitro: {
    preset: "node-server",
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist/client",
    },
    externals: {
      external: ["pdfjs-dist", "@napi-rs/canvas"],
    },
  },
  vite: {
    ssr: {
      external: ["ip-location-api", "sharp", "tinify", "pdfjs-dist", "@napi-rs/canvas"],
    },
    plugins: [serveUploadFiles()],
    server: {
      // Apache listens on 80 and 8080. This dev server stays on 8081, and
      // trenio.local.conf proxies the public name, including the HMR socket.
      // Set VITE_DEV_ORIGIN only when that proxy is not in front.
      port: 8081,
      strictPort: true,
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
