import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { CatalogSearchForm } from "@/components/catalog-search-form";

const MISS_CSS = `
.miss-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }
.miss-page__main {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding-block: 32px 48px; gap: 8px;
}
.miss-page__code { margin: 0; font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.14em; color: var(--primary); }
.miss-page h1 { margin: 0; font-size: var(--fs-page); font-weight: var(--fw-heading); letter-spacing: -0.03em; color: var(--dark); }
.miss-page__text { margin: 0 0 16px; max-width: 460px; color: var(--muted); font-size: 15px; line-height: 1.5; }
.miss-page__main .catalog-search { width: 100%; }
`;

export function CatalogMiss({
  code,
  title,
  text,
}: {
  code: "403" | "404";
  title: string;
  text: string;
}) {
  return (
    <div className="miss-page">
      <style dangerouslySetInnerHTML={{ __html: MISS_CSS }} />
      <SiteHeader />
      <main className="miss-page__main layout-container">
        <p className="miss-page__code">{code}</p>
        <h1>{title}</h1>
        <p className="miss-page__text">{text}</p>
        <CatalogSearchForm variant="hero" />
      </main>
      <SiteFooter />
    </div>
  );
}
