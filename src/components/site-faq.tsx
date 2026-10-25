import type { ReactNode } from "react";

export function SiteFaq({
  items,
  narrow,
}: {
  items: Array<{ q: string; a: ReactNode }>;
  narrow?: boolean;
}) {
  return (
    <div className={narrow ? "faq-grid faq-grid--narrow" : "faq-grid"}>
      {items.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>
            {item.q}
            <span className="faq-item__icon" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="faq-item__body">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
