import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const dir = "/Users/embatron/Projects/trenio/data/instagram-trainers/_raw";
const server = createServer((req, res) => {
  const name = basename(new URL(req.url || "/", "http://127.0.0.1").pathname);
  if (!/^[\w.-]+\.json$/.test(name)) {
    res.writeHead(400);
    res.end("bad");
    return;
  }
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    writeFileSync(join(dir, name), body);
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(String(body.length));
  });
});
server.listen(8765, "127.0.0.1");
