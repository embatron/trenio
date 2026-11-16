async (page) => {
  const posts = [
    "https://www.instagram.com/sasha_valerevna/p/De7lc8VCDd4/",
    "https://www.instagram.com/sasha_valerevna/p/DeH6xv-CHT_/",
    "https://www.instagram.com/sasha_valerevna/p/DeC9kU6iMN-/",
  ];
  const summary = [];
  for (let i = 0; i < posts.length; i += 1) {
    await page.goto(posts[i], { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1300);
    const shot = await page.screenshot({ type: "jpeg", quality: 40 });
    const text = await page.evaluate(() => ((document.querySelector("article") || document.body).innerText || "").replace(/\s+/g, " ").slice(0, 220));
    await fetch(`http://127.0.0.1:8765/sasha_valerevna.p${i + 1}.json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: posts[i], shot: Buffer.from(shot).toString("base64"), text }),
    });
    summary.push({ i: i + 1, text });
  }
  return summary;
}
