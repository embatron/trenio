async () => {
  const meta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
  const bodyText = (document.body?.innerText || "").slice(0, 2000);
  const header = document.querySelector("header");
  const headerText = (header?.innerText || "").trim();
  const ogTitle = meta('meta[property="og:title"]');
  const ogDescription = meta('meta[property="og:description"]');
  const ogImage = meta('meta[property="og:image"]');
  const hasProfile = Boolean(ogTitle || headerText);
  const unavailable = /isn.?t available|page isn.?t available|страница недоступна|к сожалению/i.test(bodyText);
  const checkpoint = /checkpoint|challenge|confirm it.?s you|подозрительн/i.test(bodyText);
  const loginWall = !hasProfile && /log in|sign up|войти|зарегистрир/i.test(bodyText);

  const thumbnailStp = /(?:^|[._])s(?:100|150)x(?:100|150)(?:[._]|$)/;
  const sourcePhotoUrl = (url) => {
    if (!url) return "";
    try {
      const next = new URL(url, location.href);
      const stp = next.searchParams.get("stp") || "";
      if (thumbnailStp.test(stp)) next.searchParams.delete("stp");
      return next.toString();
    } catch {
      return "";
    }
  };
  const imageSize = (bytes) => {
    for (let i = 0; i < bytes.length - 24; i += 1) {
      if (bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2)) {
        return { w: (bytes[i + 7] << 8) + bytes[i + 8], h: (bytes[i + 5] << 8) + bytes[i + 6] };
      }
      if (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x47) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return { w: view.getUint32(i + 16), h: view.getUint32(i + 20) };
      }
    }
    return { w: 0, h: 0 };
  };
  const headerImages = [...(header?.querySelectorAll("img") || [])].map((img) => ({
    alt: img.getAttribute("alt") || "",
    src: img.currentSrc || img.getAttribute("src") || "",
    width: img.naturalWidth || img.width || 0,
  }));

  const externalUrl =
    [...(header?.querySelectorAll("a[href]") || [])]
      .map((anchor) => anchor.href)
      .find((href) => /^https?:/i.test(href) && !/instagram\.com|facebook\.com|threads\.net|about\.instagram/i.test(href)) || "";

  const highlights = [...(header?.querySelectorAll("li") || [])]
    .map((item) => (item.innerText || "").trim().split("\n")[0] || "")
    .map((line) => line.trim())
    .filter((line) => line && line.length <= 40)
    .slice(0, 12);

  const tileRoot = (anchor) => {
    let node = anchor;
    for (let depth = 0; depth < 5 && node.parentElement; depth += 1) {
      const parent = node.parentElement;
      const hrefs = new Set(
        [...parent.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')].map((link) => link.href.split("?")[0]),
      );
      if (hrefs.size > 1) return node;
      node = parent;
    }
    return anchor;
  };
  const seenPosts = new Set();
  const posts = [];
  for (const anchor of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
    const href = anchor.href.split("?")[0];
    if (!/instagram\.com\/(p|reel)\//.test(href) || seenPosts.has(href)) continue;
    seenPosts.add(href);
    const tile = tileRoot(anchor);
    const pinned = [...tile.querySelectorAll("svg, [aria-label], [title]")].some((el) =>
      /pin|закреп/i.test(`${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`),
    );
    posts.push({ href, pinned });
  }
  const pinnedPosts = posts.filter((post) => post.pinned).slice(0, 3);

  const username = location.pathname.split("/").filter(Boolean)[0] || "";
  const profilePictures = headerImages.filter((image) => /profile picture|фото профиля/i.test(image.alt));
  const avatar =
    profilePictures.find((image) => username && image.alt.toLowerCase().includes(username.toLowerCase())) ||
    profilePictures[0] ||
    [...headerImages].sort((a, b) => b.width - a.width)[0];
  const avatarUrl = sourcePhotoUrl(avatar?.src || "") || sourcePhotoUrl(ogImage);

  let avatarBase64 = "";
  let avatarMime = "";
  let avatarWidth = 0;
  let avatarHeight = 0;
  if (avatarUrl && !unavailable && !loginWall && !checkpoint) {
    try {
      const response = await fetch(avatarUrl);
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const size = imageSize(bytes);
        const usable = size.w >= 400 && size.h >= 400 && bytes.byteLength > 0 && bytes.byteLength <= 2000000;
        if (usable) {
          let binary = "";
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
          avatarBase64 = btoa(binary);
          avatarMime = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
          avatarWidth = size.w;
          avatarHeight = size.h;
        }
      }
    } catch {
      avatarBase64 = "";
    }
  }

  return {
    sourceUrl: location.href,
    blocked: unavailable ? "unavailable" : checkpoint ? "checkpoint" : loginWall ? "login" : null,
    ogTitle,
    ogDescription,
    ogImage,
    headerText,
    headerImages: headerImages.map(({ alt, src, width }) => ({ alt, src, width })),
    externalUrl,
    highlights,
    posts,
    pinnedPosts,
    avatarUrl,
    avatarMime,
    avatarBase64,
    avatarWidth,
    avatarHeight,
  };
}
