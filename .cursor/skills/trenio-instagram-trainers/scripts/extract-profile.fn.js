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

  const thumbnailStp = /(?:^|[._])s(?:100|150|206)x(?:100|150|206)(?:[._]|$)/;
  const isThumbnailUrl = (url) => {
    try {
      const next = new URL(url, location.href);
      const stp = next.searchParams.get("stp") || "";
      if (thumbnailStp.test(stp) || /[?&]stp=/.test(next.search)) return true;
      return /\/s(?:100|150|206)x(?:100|150|206)\//.test(next.pathname);
    } catch {
      return true;
    }
  };
  const sourcePhotoUrl = (url) => {
    if (!url || isThumbnailUrl(url)) return "";
    try {
      return new URL(url, location.href).toString();
    } catch {
      return "";
    }
  };
  const fileStem = (url) => {
    try {
      const name = new URL(url, location.href).pathname.split("/").pop() || "";
      return name.replace(/\.[a-z0-9]+$/i, "");
    } catch {
      return "";
    }
  };
  const sourceCandidates = (pictureSrc) => {
    const stem = fileStem(pictureSrc);
    const urls = new Set();
    const add = (url) => {
      const next = sourcePhotoUrl(url);
      if (next) urls.add(next);
    };
    if (stem) {
      for (const entry of performance.getEntriesByType("resource")) {
        if (String(entry.name).includes(stem)) add(entry.name);
      }
      const html = document.documentElement.innerHTML
        .replace(/\\u0026/g, "&")
        .replace(/\\\//g, "/")
        .replace(/&amp;/g, "&");
      const re = /https:\/\/[^"'\\\s<>]+/g;
      let match;
      while ((match = re.exec(html))) {
        if (match[0].includes(stem)) add(match[0]);
      }
    }
    add(pictureSrc);
    return [...urls].slice(0, 6);
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
    if (bytes.length > 30 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      let offset = 12;
      while (offset + 16 < bytes.length) {
        const tag = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        const size = bytes[offset + 4] + (bytes[offset + 5] << 8) + (bytes[offset + 6] << 16) + bytes[offset + 7] * 16777216;
        if (tag === "VP8X") {
          return {
            w: 1 + bytes[offset + 12] + (bytes[offset + 13] << 8) + (bytes[offset + 14] << 16),
            h: 1 + bytes[offset + 15] + (bytes[offset + 16] << 8) + (bytes[offset + 17] << 16),
          };
        }
        if (tag === "VP8 ") {
          const start = offset + 8;
          for (let j = start; j < Math.min(bytes.length - 9, start + 64); j += 1) {
            if (bytes[j] === 0x9d && bytes[j + 1] === 0x01 && bytes[j + 2] === 0x2a) {
              return {
                w: (bytes[j + 3] + (bytes[j + 4] << 8)) & 0x3fff,
                h: (bytes[j + 5] + (bytes[j + 6] << 8)) & 0x3fff,
              };
            }
          }
        }
        const step = 8 + size + (size % 2);
        if (step <= 0) break;
        offset += step;
      }
    }
    return { w: 0, h: 0 };
  };
  const measured = async (bytes, mime) => {
    const parsed = imageSize(bytes);
    if (parsed.w >= 400 && parsed.h >= 400) return parsed;
    const blob = new Blob([bytes], { type: mime || "image/jpeg" });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      return { w: image.naturalWidth || parsed.w, h: image.naturalHeight || parsed.h };
    } catch {
      return parsed;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };
  const headerImages = [...(header?.querySelectorAll("img") || [])].map((img) => ({
    alt: img.getAttribute("alt") || "",
    src: img.currentSrc || img.getAttribute("src") || "",
    width: img.naturalWidth || img.width || 0,
  }));

  const more = [...(header?.querySelectorAll("button, [role=button]") || [])].find((button) => /^(more|ещё|еще)$/i.test((button.innerText || "").trim()));
  if (more) more.click();

  const pageHrefs = [...(header?.querySelectorAll("a[href]") || []), ...document.querySelectorAll("[role=dialog] a[href]")].map((anchor) => anchor.href);
  const emails = [...new Set(pageHrefs.flatMap((href) => {
    const match = href.match(/^mailto:([^?]+)/i);
    return match ? [decodeURIComponent(match[1])] : [];
  }))];
  const phones = [...new Set(pageHrefs.flatMap((href) => {
    const match = href.match(/^tel:([^?]+)/i);
    return match ? [decodeURIComponent(match[1])] : [];
  }))];
  const telegrams = [...new Set(pageHrefs.filter((href) => /(?:t\.me|telegram\.me|telegram\.org)\//i.test(href)))];
  const externalUrl =
    pageHrefs.find((href) => /^https?:/i.test(href) && !/instagram\.com|facebook\.com|threads\.|about\.instagram|t\.me|telegram\./i.test(href)) || "";

  const highlightLinks = [];
  const seenHighlights = new Set();
  for (const anchor of document.querySelectorAll('a[href*="/stories/highlights/"]')) {
    const href = anchor.href.split("?")[0];
    const title = (anchor.innerText || "").trim().split("\n")[0].trim();
    if (!title || seenHighlights.has(href)) continue;
    seenHighlights.add(href);
    highlightLinks.push({ title, href });
  }
  const highlights = highlightLinks.map((item) => item.title);

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
  const avatarCandidates = [...sourceCandidates(avatar?.src || ""), sourcePhotoUrl(ogImage)].filter(Boolean);

  let avatarBase64 = "";
  let avatarMime = "";
  let avatarWidth = 0;
  let avatarHeight = 0;
  let avatarUrl = "";
  if (!unavailable && !loginWall && !checkpoint) {
    for (const candidate of avatarCandidates) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        const size = await measured(bytes, (response.headers.get("content-type") || "").split(";")[0]);
        const usable = size.w >= 400 && size.h >= 400 && bytes.byteLength > 0 && bytes.byteLength <= 2000000;
        if (!usable || size.w * size.h <= avatarWidth * avatarHeight) continue;
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        avatarBase64 = btoa(binary);
        avatarMime = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
        avatarWidth = size.w;
        avatarHeight = size.h;
        avatarUrl = candidate;
      } catch {
        // The next candidate from the same page may still be the source file.
      }
    }
  }

  return {
    sourceUrl: location.href,
    blocked: unavailable ? "unavailable" : checkpoint ? "checkpoint" : loginWall ? "login" : null,
    ogTitle,
    ogDescription,
    ogImage,
    headerText: (document.querySelector("header")?.innerText || headerText).trim(),
    headerImages: headerImages.map(({ alt, src, width }) => ({ alt, src, width })),
    externalUrl,
    contacts: { emails, phones, telegrams },
    highlights,
    highlightLinks,
    posts,
    pinnedPosts,
    avatarUrl,
    avatarMime,
    avatarBase64,
    avatarWidth,
    avatarHeight,
  };
}
