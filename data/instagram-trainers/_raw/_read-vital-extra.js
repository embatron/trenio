async (page) => {
  const fresh = await page.context().newPage();
  await fresh.setViewportSize({ width: 1280, height: 1400 });
  const jobs = [
    "https://www.instagram.com/vitalkrutolevich/p/DWJjIJQDIqE/",
    "https://www.instagram.com/vitalkrutolevich/p/DSskguQjBFG/",
    "https://www.instagram.com/vitalkrutolevich/p/DR5SBo0jv45/",
  ];
  const summaries = [];
  for (const url of jobs) {
    const id = url.split("/").filter(Boolean).pop();
    await fresh.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await fresh.waitForTimeout(2200);
    const shot = await fresh.evaluate(async () => {
      const more = [...document.querySelectorAll("span, h2, h3")].find((el) =>
        /more posts|другие публикации/i.test((el.innerText || "").trim()),
      );
      const limit = more ? more.getBoundingClientRect().top : 1000;
      const imgs = [...document.querySelectorAll("img")].map((img) => {
        const box = img.getBoundingClientRect();
        return { src: img.currentSrc || img.getAttribute("src") || "", alt: img.getAttribute("alt") || "", top: box.top, area: box.width * box.height, boxW: box.width };
      }).filter((img) => img.boxW >= 200 && img.top >= 0 && img.top < limit - 8 && !/profile picture/i.test(img.alt));
      imgs.sort((a, b) => b.area - a.area);
      const src = imgs[0]?.src || "";
      if (!src) return { error: "no image", caption: (document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "").slice(0, 180) };
      const response = await fetch(src);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mime = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
      const blob = new Blob([bytes], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectUrl;
      try { await image.decode(); } catch {}
      const width = image.naturalWidth || 0;
      const height = image.naturalHeight || 0;
      URL.revokeObjectURL(objectUrl);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return {
        src,
        width,
        height,
        mime,
        bytes: bytes.length,
        alt: (imgs[0].alt || "").slice(0, 120),
        base64: width >= 400 && height >= 400 ? btoa(binary) : "",
        caption: (document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "").slice(0, 200),
      };
    });
    if (shot.base64) {
      const file = "/Users/embatron/Projects/trenio/data/instagram-trainers/_raw/vital-extra-" + id + ".json";
      const [download] = await Promise.all([
        fresh.waitForEvent("download", { timeout: 20000 }),
        fresh.evaluate((body) => {
          const blob = new Blob([body], { type: "application/json" });
          const anchor = document.createElement("a");
          anchor.href = URL.createObjectURL(blob);
          anchor.download = "extra.json";
          document.body.appendChild(anchor);
          anchor.click();
        }, JSON.stringify({ url, photo: { url: shot.src, mime: shot.mime, width: shot.width, height: shot.height, alt: shot.alt, base64: shot.base64 } })),
      ]);
      await download.saveAs(file);
    }
    summaries.push({ id, width: shot.width, height: shot.height, bytes: shot.bytes, alt: shot.alt, caption: shot.caption, error: shot.error, saved: Boolean(shot.base64) });
  }
  return summaries;
}
