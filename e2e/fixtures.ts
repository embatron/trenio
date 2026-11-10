import { test as base, expect, type Page } from "@playwright/test";

/**
 * Dev HTML points styles at http://trenio.local so Apache on port 80 can proxy
 * them. Playwright opens 127.0.0.1:8081, and that host name does not answer,
 * so the load event never fires. Fetch those assets from the app under test.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = baseURL ?? "http://127.0.0.1:8081";
    await page.route("http://trenio.local/**", async (route) => {
      const url = route.request().url().replace("http://trenio.local", origin);
      const response = await route.fetch({ url });
      await route.fulfill({ response });
    });
    await use(page);
  },
});

export { expect, type Page };
