async (page) => {
  const posts = [
    "https://www.instagram.com/artemzaec/p/DXRXV0Ol_TS/",
    "https://www.instagram.com/artemzaec/p/DVdc65TDEpq/",
    "https://www.instagram.com/artemzaec/p/DUQ96z9jJtg/",
  ];
  const summary = [];
  for (let i = 0; i < posts.length; i += 1) {
    await page.goto(posts[i], { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    const shot = await page.screenshot({ type: "jpeg", quality: 42 });
    const meta = await page.evaluate(() => {
      const article = document.querySelector("article") || document.querySelector("main");
      return {
        text: (article?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 350),
        video: Boolean(article?.querySelector("video")),
      };
    });
    const id = `p${i + 1}`;
    await fetch(`http://127.0.0.1:8765/artemzaec.${id}.json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: posts[i], shot: Buffer.from(shot).toString("base64"), ...meta }),
    });
    summary.push({ id, url: posts[i], video: meta.video, text: meta.text.slice(0, 240) });
  }
  return summary;
}
