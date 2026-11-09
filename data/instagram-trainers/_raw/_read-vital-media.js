async (page) => {
  const fresh = await page.context().newPage();
  await fresh.setViewportSize({ width: 1280, height: 1400 });
  const jobs = [
    { id: "C2rra_copzI", url: "https://www.instagram.com/vitalkrutolevich/p/C2rra_copzI/", clicks: [0, 2] },
    { id: "DL4MCKjMqjH", url: "https://www.instagram.com/vitalkrutolevich/reel/DL4MCKjMqjH/", clicks: [0] },
    { id: "De2QMhsOVxI", url: "https://www.instagram.com/vitalkrutolevich/reel/De2QMhsOVxI/", clicks: [0] },
    { id: "DeuTMZJuUGY", url: "https://www.instagram.com/vitalkrutolevich/reel/DeuTMZJuUGY/", clicks: [0] },
    { id: "DekR3SWxZhk", url: "https://www.instagram.com/vitalkrutolevich/reel/DekR3SWxZhk/", clicks: [0] },
    { id: "DdBfd33uv6V", url: "https://www.instagram.com/vitalkrutolevich/p/DdBfd33uv6V/", clicks: [0] },
  ];
  const summaries = [];
  for (const job of jobs) {
    await fresh.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await fresh.waitForTimeout(2200);
    const photos = [];
    let meta = null;
    for (const click of job.clicks) {
      let guard = 0;
      while (guard < click) {
        const moved = await fresh.evaluate(() => {
          const button = [...document.querySelectorAll("button[aria-label]")].find((el) =>
            /^(?:next|далее|вперёд|вперед|следующ)/iu.test((el.getAttribute("aria-label") || "").trim()),
          );
          if (!button) return false;
          button.click();
          return true;
        });
        if (!moved) break;
        guard += 1;
        await fresh.waitForTimeout(900);
      }
      const shot = await fresh.evaluate(async () => {
        const thumbnailStp = /(?:^|[._])s(?:100|150|206)x(?:100|150|206)(?:[._]|$)/;
  const isThumbnailUrl = (url) => {
    try {
      const next = new URL(url, location.href);
      const stp = next.searchParams.get("stp") || "";
      if (thumbnailStp.test(stp)) return true;
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

  
        const more = [...document.querySelectorAll("span, h2, h3")].find((el) =>
          /more posts|другие публикации/i.test((el.innerText || "").trim()),
        );
        const limit = more ? more.getBoundingClientRect().top : 1100;
        const imgs = [...document.querySelectorAll("img")].map((img) => {
          const box = img.getBoundingClientRect();
          return {
            src: img.currentSrc || img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
            top: box.top,
            boxW: box.width,
            boxH: box.height,
          };
        }).filter((img) => img.boxW >= 180 && img.boxH >= 180 && img.top >= 0 && img.top < limit - 8 && !/profile picture|фото профиля/i.test(img.alt));
        imgs.sort((a, b) => b.boxW * b.boxH - a.boxW * a.boxH);
        const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
        const poster = document.querySelector("video")?.getAttribute("poster") || "";
        const seeds = [...imgs.slice(0, 2).map((img) => img.src), poster, og].filter(Boolean);
        let best = null;
        const seen = new Set();
        for (const seed of seeds) {
          for (const candidate of sourceCandidates(seed)) {
            if (seen.has(candidate)) continue;
            seen.add(candidate);
            try {
              const response = await fetch(candidate);
              if (!response.ok) continue;
              const bytes = new Uint8Array(await response.arrayBuffer());
              if (!bytes.byteLength || bytes.byteLength > 1500000) continue;
              const mime = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
              const size = await measured(bytes, mime);
              if (size.w < 400 || size.h < 400) continue;
              if (best && Math.min(size.w, size.h) < Math.min(best.width, best.height)) continue;
              if (best && Math.min(size.w, size.h) === Math.min(best.width, best.height) && size.w * size.h <= best.width * best.height) continue;
              let binary = "";
              for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
              best = { url: candidate, mime, width: size.w, height: size.h, base64: btoa(binary), alt: imgs[0]?.alt || "" };
            } catch {}
          }
        }
        return {
          best,
          ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "",
          heading: (document.querySelector("h1")?.innerText || "").trim(),
          visibleText: ((document.querySelector("article") || document.querySelector("main"))?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2500),
          imgCount: imgs.length,
          top: imgs[0] ? { boxW: Math.round(imgs[0].boxW), boxH: Math.round(imgs[0].boxH), alt: imgs[0].alt.slice(0, 80) } : null,
        };
      });
      meta = shot;
      if (shot.best && !photos.some((photo) => photo.url === shot.best.url)) photos.push(shot.best);
      if (click !== 0) {
        for (let back = 0; back < guard; back += 1) {
          await fresh.evaluate(() => {
            const button = [...document.querySelectorAll("button[aria-label]")].find((el) =>
              /^(?:prev|назад|предыдущ)/iu.test((el.getAttribute("aria-label") || "").trim()),
            );
            if (button) button.click();
          });
          await fresh.waitForTimeout(400);
        }
      }
    }
    const payload = {
      url: job.url,
      ogDescription: meta?.ogDescription || "",
      heading: meta?.heading || "",
      visibleText: meta?.visibleText || "",
      photos: photos.slice(0, 2),
    };
    const file = "/Users/embatron/Projects/trenio/data/instagram-trainers/_raw/vital-media-" + job.id + ".json";
    const [download] = await Promise.all([
      fresh.waitForEvent("download", { timeout: 20000 }),
      fresh.evaluate((body) => {
        const blob = new Blob([body], { type: "application/json" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = "media.json";
        document.body.appendChild(anchor);
        anchor.click();
      }, JSON.stringify(payload)),
    ]);
    await download.saveAs(file);
    summaries.push({
      id: job.id,
      photos: photos.map((photo) => ({ width: photo.width, height: photo.height, bytes: photo.base64.length })),
      imgCount: meta?.imgCount,
      top: meta?.top,
      caption: (meta?.ogDescription || "").slice(0, 280),
    });
  }
  return summaries;
}
