async (page) => {
  const posts = [
    "https://www.instagram.com/gres_helen/p/CUTA2ZyIAnl/",
    "https://www.instagram.com/gres_helen/p/CSnN09xo_YR/",
    "https://www.instagram.com/gres_helen/p/CR9OM_GIpR2/",
    "https://www.instagram.com/gres_helen/p/CQdJg-kB_hu/",
    "https://www.instagram.com/gres_helen/p/CPvukt7hb3J/",
    "https://www.instagram.com/gres_helen/p/CPNKG8MBWs5/",
  ];
  const summary = [];
  for (let i = 0; i < posts.length; i += 1) {
    await page.goto(posts[i], { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    const shot = await page.screenshot({ type: "jpeg", quality: 45 });
    const meta = await page.evaluate(() => {
      const article = document.querySelector("article") || document.querySelector("main");
      const text = (article?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400);
      const img = article?.querySelector("img:not([alt*='profile picture'])");
      return {
        text,
        alt: img?.getAttribute("alt") || "",
        video: Boolean(article?.querySelector("video")),
      };
    });
    const id = `m${i + 1}`;
    const saved = await fetch(`http://127.0.0.1:8765/gres_helen.${id}.json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: posts[i], shot: Buffer.from(shot).toString("base64"), ...meta }),
    });
    summary.push({ id, saved: saved.status, url: posts[i], video: meta.video, alt: meta.alt.slice(0, 160), text: meta.text.slice(0, 220) });
  }
  return summary;
}
