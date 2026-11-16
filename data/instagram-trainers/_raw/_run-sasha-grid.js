async (page) => {
  await page.goto("https://www.instagram.com/sasha_valerevna/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const photos = [];
  const seen = new Set();
  let stuck = 0;
  let last = 0;
  for (let i = 0; i < 12; i += 1) {
    const batch = await page.evaluate(() => {
      const username = location.pathname.split("/").filter(Boolean)[0] || "";
      const rows = [];
      const local = new Set();
      for (const anchor of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
        const href = anchor.href.split("?")[0];
        if (local.has(href)) continue;
        const parts = new URL(href).pathname.split("/").filter(Boolean);
        let owner = "";
        let kind = "";
        if (parts[0] === "p" || parts[0] === "reel") {
          kind = parts[0];
          owner = username;
        } else {
          owner = parts[0] || "";
          kind = parts[1] || "";
        }
        if (owner.toLowerCase() !== username.toLowerCase()) continue;
        local.add(href);
        rows.push({ href, kind });
      }
      return { rows, height: document.body.scrollHeight };
    });
    for (const row of batch.rows) {
      if (row.kind === "p" && !seen.has(row.href)) {
        seen.add(row.href);
        photos.push(row.href);
      }
    }
    if (photos.length >= 4) break;
    if (batch.height === last) stuck += 1;
    else stuck = 0;
    last = batch.height;
    if (stuck >= 3) break;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
  }
  return { photoCount: photos.length, photos: photos.slice(0, 6), height: last };
}
