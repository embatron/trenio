async (page) => {
  const fresh = await page.context().newPage();
  await fresh.setViewportSize({ width: 1280, height: 1400 });
  const jobs = [
    ["DL4MCKjMqjH", "https://www.instagram.com/vitalkrutolevich/reel/DL4MCKjMqjH/"],
    ["De2QMhsOVxI", "https://www.instagram.com/vitalkrutolevich/reel/De2QMhsOVxI/"],
  ];
  const summaries = [];
  for (const [id, url] of jobs) {
    await fresh.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await fresh.waitForTimeout(2000);
    const shot = await fresh.evaluate(async () => {
      const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
      if (!og) return { og: "", error: "no og" };
      const response = await fetch(og);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mime = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
      const blob = new Blob([bytes], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return { og, width, height, mime, bytes: bytes.length, base64: btoa(binary) };
    });
    const file = "/Users/embatron/Projects/trenio/data/instagram-trainers/_raw/vital-og-" + id + ".json";
    const [download] = await Promise.all([
      fresh.waitForEvent("download", { timeout: 20000 }),
      fresh.evaluate((body) => {
        const blob = new Blob([body], { type: "application/json" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = "og.json";
        document.body.appendChild(anchor);
        anchor.click();
      }, JSON.stringify({ url, photo: { url: shot.og, mime: shot.mime, width: shot.width, height: shot.height, base64: shot.base64 } })),
    ]);
    await download.saveAs(file);
    summaries.push({ id, width: shot.width, height: shot.height, bytes: shot.bytes, mime: shot.mime });
  }
  return summaries;
}
