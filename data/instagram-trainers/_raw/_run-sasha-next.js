async (page) => {
  const shots = [];
  for (let i = 0; i < 3; i += 1) {
    const next = page.getByRole("button", { name: /^(next|далее|вперёд|вперед)$/i });
    if (!(await next.count())) break;
    await next.first().click();
    await page.waitForTimeout(800);
    const shot = await page.screenshot({ type: "jpeg", quality: 40 });
    shots.push(Buffer.from(shot).toString("base64"));
  }
  await fetch("http://127.0.0.1:8765/sasha_valerevna.next.json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ shots }),
  });
  return { count: shots.length };
}
