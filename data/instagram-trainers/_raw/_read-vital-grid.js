async (page) => {
  const fresh = await page.context().newPage();
  await fresh.setViewportSize({ width: 1280, height: 1400 });
  await fresh.goto("https://www.instagram.com/vitalkrutolevich/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await fresh.waitForTimeout(2000);
  for (let i = 0; i < 6; i += 1) {
    await fresh.mouse.wheel(0, 1400);
    await fresh.waitForTimeout(900);
  }
  const posts = await fresh.evaluate(() => {
    const seen = new Set();
    const rows = [];
    for (const anchor of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
      const href = anchor.href.split("?")[0];
      if (!href.includes("/vitalkrutolevich/") || seen.has(href)) continue;
      seen.add(href);
      rows.push(href);
    }
    return rows;
  });
  return { count: posts.length, photos: posts.filter((href) => href.includes("/p/")), reels: posts.filter((href) => href.includes("/reel/")).length };
}
