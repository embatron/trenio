async (page) => {
  const fs = await import("node:fs");
  const fn = fs.readFileSync(
    "/Users/embatron/Projects/trenio/.cursor/skills/trenio-instagram-trainers/scripts/extract-profile.fn.js",
    "utf8",
  );
  const result = await page.evaluate(fn);
  fs.mkdirSync("/Users/embatron/Projects/trenio/data/instagram-trainers/_raw", { recursive: true });
  fs.writeFileSync(
    "/Users/embatron/Projects/trenio/data/instagram-trainers/_raw/liza_femininity.header.json",
    JSON.stringify(result),
  );
  const { avatarBase64, headerImages, ...rest } = result;
  return {
    ...rest,
    avatarBase64Length: avatarBase64 ? avatarBase64.length : 0,
    headerImageAlts: (headerImages || []).map((image) => image.alt),
  };
}
