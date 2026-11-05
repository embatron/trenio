# Search cabinets and counters

One Google Analytics tag and one Yandex Metrika counter. Both load from the root document in `src/routes/__root.tsx`. The ids live in `src/lib/seo/analytics.ts`. The service worker does not cache pages and does not intercept these scripts.

## Google Analytics

| | |
| --- | --- |
| Account | `414205952` |
| Property | `561685869` (`trenio.by`) |
| Web stream | `16237727468`, URL `https://trenio.by` |
| Measurement ID | `G-DYGP8VFTHC` |
| Google account | `eakull@gmail.com` |

The tag is `gtag.js` plus `googleAnalyticsSnippet`. Do not add a second property, a second tag, or Google Tag Manager. There is no consent banner. The home card in Analytics is active users, not sessions.

## Google Search Console

URL-prefix property `https://trenio.by`. HTTP and `www` redirect to that origin. The sitemap to submit is `https://trenio.by/sitemap.xml`. The HTML verification file already in `public/` is the current one. Do not commit a new verification token.

Google does not publish a Search Console MCP server. Do not add a third-party one.

## Yandex Webmaster

| | |
| --- | --- |
| Account | `EAKSoll@yandex.by` |
| Site | `https://trenio.by` |
| Region | Request for Belarus (`Беларусь`), proof page `https://trenio.by/`. Moderation can take 7 days. Do not bind the catalog to Minsk only. |

`robots.txt` already sends `Host: trenio.by` and `Sitemap: https://trenio.by/sitemap.xml`. On 5 Nov 2026 the Sitemap screen was read-only because of a Yandex incident, so the file was not uploaded in the cabinet. Do not upload it a second time when the screen works again.

Do not start a site move. Do not add a Yandex Business card: the contacts page has no street address, and the graph has no telephone.

Yandex does not publish a Webmaster MCP server. Do not add a third-party one.

## Yandex Metrika

| | |
| --- | --- |
| Counter | `114087488` |
| Name and site | `trenio.by` |
| Account | `EAKSoll@yandex.by` |
| Timezone | GMT+3 (the wizard value is Moscow, the same offset as Minsk) |
| Currency | RUB, the wizard default. The site does not send ecommerce. |
| Webvisor | Off. Click map, outbound links, and accurate bounce stay on. |

`yandexMetrikaSnippet` loads `https://mc.yandex.ru/metrika/tag.js` once and calls `ym` with `webvisor:false`. A noscript pixel sits in the root body. The privacy page names both counters and says Webvisor is off. Do not turn Webvisor on without changing that page: the site has messages and sign-in.

Yandex does not publish a Metrika MCP server. Do not add a third-party one.

## Official MCP

The only official server among these four is Google Analytics: package `analytics-mcp` from `googleanalytics/google-analytics-mcp`. It is read-only. It needs Python 3.10 or newer, `uvx` or `pipx`, Application Default Credentials with the scope `https://www.googleapis.com/auth/analytics.readonly`, and `GOOGLE_CLOUD_PROJECT` set to a project where the Analytics Admin API and the Analytics Data API are enabled.

Cursor config, from Google's own guide:

```json
{
  "mcpServers": {
    "google-analytics-mcp": {
      "command": "uvx",
      "args": ["--from", "analytics-mcp", "google-analytics-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "PATH_TO_CREDENTIALS_JSON",
        "GOOGLE_CLOUD_PROJECT": "YOUR_PROJECT_ID"
      }
    }
  }
}
```

This laptop has Python 3.9.6, no `uv`, no `gcloud`, and no Application Default Credentials, so the server is not connected. Do not add the block until those exist: a server that cannot sign in fails on every chat. Do not commit a credentials file.
