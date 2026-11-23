async (page) => {
  const fs = process.getBuiltinModule("node:fs");
  const path = process.getBuiltinModule("node:path");
  const fnSrc = fs.readFileSync(
    "/Users/embatron/Projects/trenio/.cursor/skills/trenio-instagram-trainers/scripts/extract-profile.fn.js",
    "utf8",
  );
  const result = await page.evaluate(eval(fnSrc));
  const out = "/Users/embatron/Projects/trenio/data/instagram-trainers/_raw/vika_krez.extract.json";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result));
  const { avatarBase64, headerImages, ...rest } = result;
  return {
    ...rest,
    headerImageAlts: (headerImages || []).map((image) => ({ alt: image.alt, width: image.width })),
    avatarBase64Length: avatarBase64 ? avatarBase64.length : 0,
  };
}
