import fs from "node:fs";
import path from "node:path";
import type { Connect, Plugin } from "vite";

const UPLOAD_PREFIXES = ["/trainers/", "/avatars/"];

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function uploadPath(url: string | undefined): string | null {
  const raw = url?.split("?")[0] ?? "";
  if (!UPLOAD_PREFIXES.some((prefix) => raw.startsWith(prefix))) return null;
  let pathname = raw;
  try {
    pathname = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (pathname.includes("\0") || pathname.split("/").includes("..")) return null;
  return pathname;
}

// Gitignored uploads are missing from Vite's public-file snapshot, so a new
// photo 404s until the dev server restarts. Serve the file from disk instead.
export function serveUploadFiles(): Plugin {
  return {
    name: "trenio-serve-upload-files",
    configureServer(server) {
      const publicDir = path.resolve(server.config.publicDir);
      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const pathname = uploadPath(req.url);
        if (!pathname) {
          next();
          return;
        }
        const file = path.resolve(publicDir, `.${pathname}`);
        if (file !== publicDir && !file.startsWith(publicDir + path.sep)) {
          next();
          return;
        }
        const type = TYPES[path.extname(file).toLowerCase()];
        if (!type) {
          next();
          return;
        }
        fs.stat(file, (error, stat) => {
          if (error || !stat.isFile()) {
            next();
            return;
          }
          res.setHeader("Content-Type", type);
          res.setHeader("Cache-Control", "no-cache");
          fs.createReadStream(file).pipe(res);
        });
      };
      server.middlewares.use(middleware);
    },
  };
}
