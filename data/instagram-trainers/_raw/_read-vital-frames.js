async (page) => {
  const fresh = await page.context().newPage();
  await fresh.setViewportSize({ width: 1280, height: 1600 });
  const urls = [
    ["DL4MCKjMqjH", "https://www.instagram.com/vitalkrutolevich/reel/DL4MCKjMqjH/"],
    ["De2QMhsOVxI", "https://www.instagram.com/vitalkrutolevich/reel/De2QMhsOVxI/"],
  ];
  const out = [];
  for (const [id, url] of urls) {
    await fresh.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await fresh.waitForTimeout(2500);
    const box = await fresh.evaluate(() => {
      const video = document.querySelector("video");
      if (!video) return null;
      const rect = video.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    if (box && box.width >= 200 && box.height >= 200) {
      const path = "/Users/embatron/Projects/trenio/data/instagram-trainers/_raw/vital-frame-" + id + ".png";
      await fresh.screenshot({ path, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height } });
      out.push({ id, box });
    } else {
      out.push({ id, box, missing: true });
    }
  }
  return out;
}
