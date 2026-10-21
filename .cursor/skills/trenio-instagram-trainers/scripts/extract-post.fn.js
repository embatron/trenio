async () => {
  const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
  const heading = (document.querySelector("h1")?.innerText || "").trim();
  const article = document.querySelector("article");
  const visibleText = (article?.innerText || document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 5000);
  return {
    url: location.href.split("?")[0],
    ogDescription,
    heading,
    visibleText,
  };
}
