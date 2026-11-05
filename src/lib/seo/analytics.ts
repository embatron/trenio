/** One GA4 web stream for https://trenio.by. Do not add a second tag or Tag Manager. */
export const GA_MEASUREMENT_ID = "G-DYGP8VFTHC";

/** One Yandex Metrika counter for https://trenio.by. Webvisor stays off. */
export const YM_COUNTER_ID = 114087488;

export function googleAnalyticsSnippet(id = GA_MEASUREMENT_ID): string {
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js',new Date());",
    `gtag('config','${id}');`,
  ].join("");
}

/** Official tag.js loader. Webvisor is off: no session recording. */
export function yandexMetrikaSnippet(id = YM_COUNTER_ID): string {
  return [
    "(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};",
    "m[i].l=1*new Date();",
    "for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}",
    "k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})",
    '(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");',
    `ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});`,
  ].join("");
}
