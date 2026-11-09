import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { TrainerDocument } from "@/lib/catalog/certificate-preview";

function FileMark({ ext }: { ext: string }) {
  return (
    <span className="doc-file">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M14 3v5h5" />
      </svg>
      <span>{ext}</span>
    </span>
  );
}

function DocumentFace({ item, broken, onError, large, eager }: {
  item: TrainerDocument;
  broken: boolean;
  onError: () => void;
  large?: boolean;
  eager?: boolean;
}) {
  const src = large ? item.view : item.thumb;
  if (!src || broken || (large && item.kind !== "image" && item.kind !== "pdf")) {
    return <FileMark ext={item.ext} />;
  }
  return (
    <img
      src={src}
      alt={large ? item.caption : ""}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      onError={onError}
    />
  );
}

export function TrainerDocuments({ items }: { items: TrainerDocument[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef({ left: 0, moved: false });
  const current = open == null ? null : items[page] ?? items[open] ?? null;

  useEffect(() => {
    if (open == null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, items.length]);

  useLayoutEffect(() => {
    if (open == null) return;
    const track = trackRef.current;
    if (!track) return;
    setPage(open);
    track.scrollTo({ left: open * track.clientWidth, behavior: "auto" });
  }, [open]);

  useEffect(() => {
    if (open == null) return;
    for (const index of [page - 1, page, page + 1]) {
      const src = items[index]?.view;
      if (!src) continue;
      const image = new Image();
      image.src = src;
    }
  }, [open, page, items]);

  if (items.length === 0) return null;

  function step(delta: number) {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const currentIndex = Math.round(track.scrollLeft / track.clientWidth);
    const next = Math.max(0, Math.min(items.length - 1, currentIndex + delta));
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: next * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }

  function onTrackScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    if (Math.abs(track.scrollLeft - gesture.current.left) > 6) gesture.current.moved = true;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setPage((value) => value === index ? value : index);
  }

  function onSlideClick(event: React.MouseEvent<HTMLElement>) {
    if (gesture.current.moved) {
      gesture.current.moved = false;
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("img, a, button, .doc-view__frame, figcaption")) return;
    setOpen(null);
  }

  return (
    <div className="profile-copy">
      <h2 className="profile-heading">Сертификаты и дипломы</h2>
      <ul className="doc-rail">
        {items.map((item, index) => (
          <li key={item.path}>
            <button type="button" className="doc-card" aria-label={item.caption} onClick={() => setOpen(index)}>
              <span className="doc-card__frame">
                <DocumentFace
                  item={item}
                  broken={Boolean(broken[item.thumb])}
                  onError={() => setBroken((state) => ({ ...state, [item.thumb]: true }))}
                />
              </span>
              <span className="doc-card__caption">{item.caption}</span>
            </button>
          </li>
        ))}
      </ul>
      {current && open != null ? (
        <div className="doc-view" role="dialog" aria-modal="true" aria-label="Документы">
          <button ref={closeRef} type="button" className="doc-view__close" aria-label="Закрыть" onClick={() => setOpen(null)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          {items.length > 1 ? (
            <button type="button" className="doc-view__nav doc-view__nav--prev" aria-label="Предыдущий документ" disabled={page === 0} onClick={() => step(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6" /></svg>
            </button>
          ) : null}
          <div
            ref={trackRef}
            className="doc-view__track"
            onScroll={onTrackScroll}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              gesture.current = { left: trackRef.current?.scrollLeft ?? 0, moved: false };
            }}
          >
            {items.map((item, index) => (
              <div key={item.path} className="doc-view__slide" onClick={onSlideClick}>
                <div className="doc-view__frame">
                  <DocumentFace
                    item={item}
                    large
                    eager={Math.abs(index - page) <= 1}
                    broken={Boolean(broken[item.view])}
                    onError={() => setBroken((state) => ({ ...state, [item.view]: true }))}
                  />
                </div>
                <figcaption>
                  <span>{item.caption}</span>
                  {items.length > 1 ? <small>{index + 1} из {items.length}</small> : null}
                  {item.kind !== "image" ? (
                    <a href={item.path} target="_blank" rel="noopener noreferrer">Открыть файл</a>
                  ) : null}
                </figcaption>
              </div>
            ))}
          </div>
          {items.length > 1 ? (
            <button type="button" className="doc-view__nav doc-view__nav--next" aria-label="Следующий документ" disabled={page === items.length - 1} onClick={() => step(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6" /></svg>
            </button>
          ) : null}
        </div>
      ) : null}
      <style>{DOC_CSS}</style>
    </div>
  );
}

const DOC_CSS = `
.doc-rail { display: flex; gap: 12px; margin: 0; padding: 0 0 4px; overflow-x: auto; list-style: none; scroll-snap-type: x proximity; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.doc-rail::-webkit-scrollbar { display: none; }
.doc-rail li { flex: 0 0 auto; scroll-snap-align: start; }
.doc-card { display: grid; gap: 6px; width: 104px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.doc-card__frame { display: grid; place-items: center; width: 104px; height: 132px; overflow: hidden; border: 1px solid var(--line); border-radius: 12px; background: var(--neutral-bg); }
.doc-card:hover .doc-card__frame, .doc-card:focus-visible .doc-card__frame { border-color: var(--primary); }
.doc-card__frame img { display: block; width: 100%; height: 100%; object-fit: contain; background: var(--white); }
.doc-card__caption { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.5em; color: var(--dark); font-size: 12px; font-weight: var(--fw-ui); line-height: 1.25; }
.doc-file { display: grid; justify-items: center; gap: 6px; color: var(--primary-dark); }
.doc-file svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.doc-file span { font-size: 12px; font-weight: var(--fw-title); letter-spacing: 0.04em; }
.doc-view { position: fixed; inset: 0; z-index: 420; background: rgba(20, 16, 16, 0.88); }
.doc-view__close, .doc-view__nav { position: absolute; z-index: 2; width: 44px; height: 44px; min-width: 44px; padding: 0; border: 0; border-radius: 999px; background: var(--white); color: var(--dark); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.doc-view__close { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }
.doc-view__nav { top: 50%; transform: translateY(-50%); }
.doc-view__nav--prev { left: max(8px, env(safe-area-inset-left)); }
.doc-view__nav--next { right: max(8px, env(safe-area-inset-right)); }
.doc-view__nav:disabled { opacity: 0.35; cursor: default; }
.doc-view__close svg, .doc-view__nav svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.doc-view__track { position: absolute; inset: 0; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.doc-view__track::-webkit-scrollbar { display: none; }
.doc-view__slide { flex: 0 0 100%; width: 100%; height: 100%; box-sizing: border-box; scroll-snap-align: start; scroll-snap-stop: always; display: grid; align-content: center; justify-items: center; gap: 12px; padding: max(68px, calc(env(safe-area-inset-top) + 56px)) max(64px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(64px, env(safe-area-inset-left)); }
.doc-view__frame { display: grid; place-items: center; min-width: 0; }
.doc-view__frame img, .doc-view__frame .doc-file { display: block; max-width: min(92vw, 960px); max-height: calc(100dvh - 180px); object-fit: contain; background: var(--white); border-radius: 8px; }
.doc-view__frame .doc-file { width: min(92vw, 280px); min-height: 220px; align-content: center; }
.doc-view__frame .doc-file svg { width: 42px; height: 42px; }
.doc-view figcaption { display: grid; justify-items: center; gap: 4px; max-width: min(92vw, 640px); color: #fff; font-size: 15px; font-weight: var(--fw-ui); line-height: 1.4; text-align: center; }
.doc-view figcaption small { color: rgba(255,255,255,0.72); font-size: 13px; }
.doc-view figcaption a { color: #fff; font-size: 14px; font-weight: var(--fw-title); }
@media (prefers-reduced-motion: reduce) {
  .doc-view__track { scroll-behavior: auto; }
}
`;
