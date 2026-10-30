async () => {
  const meta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
  const ogDescription = meta('meta[property="og:description"]');
  const ogImage = meta('meta[property="og:image"]');
  const heading = (document.querySelector("h1")?.innerText || "").trim();
  const article = document.querySelector("article") || document.querySelector("main");
  const visibleText = (article?.innerText || document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 5000);

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
    if (!url || url.startsWith("data:") || isThumbnailUrl(url)) return "";
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

  const seeds = [];
  const seenStems = new Set();
  const pushSeed = (src, alt) => {
    const stem = fileStem(src);
    if (!src || (stem && seenStems.has(stem))) return;
    if (stem) seenStems.add(stem);
    seeds.push({ src, alt });
  };
  for (const img of article?.querySelectorAll("img") || []) {
    const alt = img.getAttribute("alt") || "";
    if (/profile picture|фото профиля/i.test(alt)) continue;
    pushSeed(img.currentSrc || img.getAttribute("src") || "", alt);
  }
  pushSeed(ogImage, "");

  const photos = [];
  for (const seed of seeds.slice(0, 6)) {
    let best = null;
    for (const candidate of sourceCandidates(seed.src)) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > 1500000) continue;
        const mime = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
        const size = await measured(bytes, mime);
        if (size.w < 400 || size.h < 400) continue;
        if (best && size.w * size.h <= best.width * best.height) continue;
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        best = {
          url: candidate,
          alt: seed.alt,
          mime,
          width: size.w,
          height: size.h,
          base64: btoa(binary),
        };
      } catch {
        // The next candidate from this slide may still be the source file.
      }
    }
    if (best) photos.push(best);
    if (photos.length >= 2) break;
  }

  const carouselNext = [...document.querySelectorAll("button[aria-label]")].some((button) =>
    /^(?:next|далее|вперёд|вперед|следующ\p{L}*)$/iu.test((button.getAttribute("aria-label") || "").trim()),
  );

  return {
    url: location.href.split("?")[0],
    ogDescription,
    heading,
    visibleText,
    carouselNext,
    photos,
  };
}
