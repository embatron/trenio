const base = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8081").replace(/\/$/, "");
const paths = [
  "/offline.html",
  "/.well-known/assetlinks.json",
  "/.well-known/apple-app-site-association",
  "/open?path=/auth/login",
  "/open?path=https://evil.example",
];
const total = 400;
const width = 20;

async function one(index) {
  const path = paths[index % paths.length];
  const started = performance.now();
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  const location = response.headers.get("location") || "";
  if (path.startsWith("/open?path=https://evil") && /^https?:\/\/evil/i.test(location)) {
    throw new Error(`open redirect: ${location}`);
  }
  if (response.status >= 500) throw new Error(`${path} ${response.status}`);
  return performance.now() - started;
}

async function main() {
  const probe = await fetch(`${base}/offline.html`).catch(() => null);
  if (!probe) {
    console.error(`load test: ${base} is not answering`);
    process.exit(1);
  }
  const samples = [];
  for (let offset = 0; offset < total; offset += width) {
    const batch = [];
    for (let i = 0; i < width && offset + i < total; i += 1) batch.push(one(offset + i));
    samples.push(...await Promise.all(batch));
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
  console.info(`load test: ${samples.length} requests, p95 ${p95.toFixed(0)} ms`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
