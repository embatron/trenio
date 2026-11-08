import { expect, test, type Page } from "./fixtures";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  (page as { __pageErrors?: string[] }).__pageErrors = errors;
});

function pageErrors(page: Page) {
  return (page as { __pageErrors?: string[] }).__pageErrors ?? [];
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function waitForMap(page: Page) {
  await page.waitForSelector(".catalog-map [class*='ymaps'], .trainer-address__canvas [class*='ymaps'], .catalog-map__fallback", {
    timeout: 20_000,
  });
}

async function markOffset(page: Page) {
  return page.evaluate(() => {
    const map = document.querySelector(".catalog-map");
    const mark = map?.querySelector(".catalog-map__pin, .catalog-map__cluster");
    if (!map || !mark) return null;
    const frame = map.getBoundingClientRect();
    const box = mark.getBoundingClientRect();
    return {
      x: Math.round(box.left - frame.left),
      y: Math.round(box.top - frame.top),
      marks: map.querySelectorAll(".catalog-map__pin, .catalog-map__cluster").length,
    };
  });
}

test("map keeps one frame inside the cap while the scale changes", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/map");
  await waitForMap(page);
  await expect(page.locator(".catalog-map a[href*='maps_termsofuse']")).toBeVisible();
  await page.waitForSelector(".catalog-map__pin, .catalog-map__cluster", { timeout: 15_000 });
  const before = await markOffset(page);
  expect(before).not.toBeNull();
  expect(before!.marks).toBeGreaterThan(0);
  expect(before!.marks).toBeLessThanOrEqual(180);

  const map = page.locator(".catalog-map");
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const wheeled = await markOffset(page);
  expect(wheeled).toEqual(before);

  await page.locator(".catalog-map [class*='-zoom__minus']").click();
  await page.waitForTimeout(900);
  const wider = await markOffset(page);
  expect(wider).not.toBeNull();
  expect(wider!.marks).toBeLessThanOrEqual(180);
  expect(wider!.x !== before!.x || wider!.y !== before!.y || wider!.marks !== before!.marks).toBe(true);

  const pin = page.locator(".catalog-map__pin").first();
  const pinBox = await pin.boundingBox();
  expect(pinBox).not.toBeNull();
  await page.mouse.click(pinBox!.x + pinBox!.width / 2, pinBox!.y + pinBox!.height / 2);
  const tip = page.locator(".catalog-map__tip");
  await expect(tip).toBeVisible();
  const close = tip.getByRole("button", { name: "Закрыть" });
  const closeBox = await close.boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(tip).toBeHidden();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  expect(pageErrors(page)).toEqual([]);
});

test("a blocked map script leaves the list and does not hide the page", async ({ page }) => {
  test.setTimeout(45_000);
  await page.route("**://api-maps.yandex.ru/**", (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/map");
  await expect(page.getByText("Карта откроется, когда появится сеть.")).toBeVisible();
  await expect(page.locator("h1")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("map controls stay tappable on a phone and a tablet", async ({ page }) => {
  test.setTimeout(90_000);
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: width < 768 ? 700 : 900 });
    await page.goto("/map");
    await waitForMap(page);
    expect(await overflow(page), `${width} overflow`).toBeLessThanOrEqual(1);

    const zoom = page.locator(".catalog-map [class*='-zoom__plus']");
    const zoomBox = await zoom.boundingBox();
    expect(zoomBox!.width, `${width} zoom`).toBeGreaterThanOrEqual(44);
    expect(zoomBox!.height, `${width} zoom`).toBeGreaterThanOrEqual(44);
    const locate = page.locator(".catalog-map__locate");
    const locateBox = await locate.boundingBox();
    expect(locateBox!.width).toBeGreaterThanOrEqual(44);
    expect(locateBox!.height).toBeGreaterThanOrEqual(44);

    const search = page.locator(".site-header__search");
    const searchHidden = await search.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.display === "none" || style.visibility === "hidden";
    });
    if (width < 768) expect(searchHidden, `${width} header search`).toBe(true);

    const burger = page.locator(".burger-btn");
    const burgerBox = await burger.boundingBox();
    expect(burgerBox!.width).toBeGreaterThanOrEqual(44);
    expect(burgerBox!.height).toBeGreaterThanOrEqual(44);
    expect(width - (burgerBox!.x + burgerBox!.width)).toBeLessThanOrEqual(40);

    const columns = await page.locator(".map-people").evaluate((node) => (
      getComputedStyle(node).gridTemplateColumns.split(" ").filter((part) => part && part !== "0px").length
    ));
    if (width < 360) expect(columns).toBe(1);
    else if (width < 720) expect(columns).toBe(2);
    else expect(columns).toBe(3);

    const save = page.locator(".map-people .trainer-card__save").first();
    if (await save.count()) {
      const saveBox = await save.boundingBox();
      expect(saveBox!.width).toBeGreaterThanOrEqual(44);
      expect(saveBox!.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: "Фильтры" }).click();
    const chip = page.locator(".map-tax__btn").first();
    const chipBox = await chip.boundingBox();
    expect(chipBox!.height, `${width} chip`).toBeGreaterThanOrEqual(44);
    const copy = page.locator(".catalog-map [class*='copyrights-pane']").first();
    const copyHidden = await copy.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0;
    });
    expect(copyHidden, `${width} copyright`).toBe(false);
    await expect(page.locator(".catalog-map a[href*='maps_termsofuse']")).toBeVisible();
    const marks = await page.locator(".catalog-map__pin, .catalog-map__cluster").count();
    expect(marks).toBeLessThanOrEqual(180);
  }
});

test("trainer profile map and search map stay inside the screen", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trainers/1.manko");
  await waitForMap(page);
  const canvas = page.locator(".trainer-address__canvas");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox!.height).toBeGreaterThanOrEqual(280);
  await expect(canvas.locator("a[href*='maps_termsofuse']")).toBeVisible();
  const zoom = canvas.locator("[class*='-zoom__plus']");
  const zoomBox = await zoom.boundingBox();
  expect(zoomBox!.width).toBeGreaterThanOrEqual(44);
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await page.goto("/search");
  await waitForMap(page);
  await expect(page.locator(".catalog-map a[href*='maps_termsofuse']")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  const marks = await page.locator(".catalog-map__pin, .catalog-map__cluster").count();
  expect(marks).toBeLessThanOrEqual(180);
});

test("the installed app keeps the map origin", async ({ page }) => {
  await page.goto("/map");
  const head = await page.evaluate(() => ({
    manifest: document.querySelector("link[rel='manifest']")?.getAttribute("href"),
    theme: document.querySelector("meta[name='theme-color']")?.getAttribute("content"),
    viewport: document.querySelector("meta[name='viewport']")?.getAttribute("content"),
  }));
  expect(head.manifest).toBe("/manifest.webmanifest");
  expect(head.theme).toBe("#f04b50");
  expect(head.viewport).toContain("viewport-fit=cover");
  const manifest = await page.request.get("/manifest.webmanifest");
  const body = await manifest.json() as { display: string; icons: Array<{ sizes: string }> };
  expect(body.display).toBe("standalone");
  expect(body.icons.some((icon) => icon.sizes === "192x192")).toBe(true);
  expect(body.icons.some((icon) => icon.sizes === "512x512")).toBe(true);
});
