/** One GA4 web stream for https://trenio.by. Do not add a second tag or Tag Manager. */
export const GA_MEASUREMENT_ID = "G-DYGP8VFTHC";

export function googleAnalyticsSnippet(id = GA_MEASUREMENT_ID): string {
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js',new Date());",
    `gtag('config','${id}');`,
  ].join("");
}
