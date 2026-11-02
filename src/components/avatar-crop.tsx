import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FRAME = 240;
const OUTPUT = 512;

const CSS = `
.avatar-crop-modal {
  position: fixed; inset: 0; z-index: 400;
  display: grid; place-items: center;
  padding: max(16px, var(--layout-gutter));
  background: rgba(var(--dark-rgb), 0.45);
}
.avatar-crop-modal__card {
  width: min(360px, 100%);
  max-height: min(92vh, 720px);
  overflow: auto;
  display: grid; gap: 12px; justify-items: center;
  padding: 20px;
  border-radius: var(--card-radius);
  background: var(--white);
}
.avatar-crop-modal__card h2 { margin: 0; justify-self: start; font-size: 18px; color: var(--dark); }
.avatar-crop__frame {
  width: min(${FRAME}px, 100%);
  aspect-ratio: 1;
  box-sizing: content-box;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  background: var(--light-bg);
  box-shadow: inset 0 0 0 1px var(--line);
  touch-action: none;
  cursor: grab;
}
.avatar-crop__frame:active { cursor: grabbing; }
.avatar-crop__frame img {
  position: absolute;
  max-width: none;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}
.avatar-crop__hint { margin: 0; align-self: stretch; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.avatar-crop__size { display: grid; gap: 4px; width: min(${FRAME}px, 100%); }
.avatar-crop__size span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.avatar-crop__size input[type="range"] {
  width: 100%; min-height: 44px; margin: 0; padding: 0;
  border: 0; border-radius: 0; background: transparent;
  accent-color: var(--primary); box-shadow: none;
}
.avatar-crop__actions { display: flex; flex-wrap: wrap; gap: 8px; align-self: stretch; }
.avatar-crop__save, .avatar-crop__cancel {
  min-height: 44px; padding: 0 18px; border-radius: 999px;
  font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer;
}
.avatar-crop__save { border: 0; background: var(--primary); color: #fff; }
.avatar-crop__save:disabled { opacity: 0.6; cursor: default; }
.avatar-crop__cancel { border: 1px solid var(--line); background: var(--white); color: var(--dark); }
.avatar-crop__save:focus-visible, .avatar-crop__cancel:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
`;

type Loaded = { image: HTMLImageElement; zoom: number };

function frameOf(image: HTMLImageElement, zoom: number, panX: number, panY: number, frame: number) {
  const contain = Math.min(frame / image.width, frame / image.height);
  const cover = Math.max(frame / image.width, frame / image.height);
  const max = cover * 2.4;
  const scale = contain + (max - contain) * zoom;
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const limitX = Math.abs(frame - drawW) / 2;
  const limitY = Math.abs(frame - drawH) / 2;
  const x = (frame - drawW) / 2 + Math.min(limitX, Math.max(-limitX, panX));
  const y = (frame - drawH) / 2 + Math.min(limitY, Math.max(-limitY, panY));
  const coverZoom = max === contain ? 0 : (cover - contain) / (max - contain);
  return { x, y, drawW, drawH, coverZoom };
}

/** The file is the square currently visible inside the circle, not a recomputed crop. */
function paintVisible(source: HTMLImageElement, frame: HTMLDivElement, shown: HTMLImageElement) {
  const frameBox = frame.getBoundingClientRect();
  const imgBox = shown.getBoundingClientRect();
  const innerW = frame.clientWidth || frameBox.width;
  const innerH = frame.clientHeight || frameBox.height;
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext("2d");
  if (!ctx || innerW < 1 || innerH < 1) throw new Error("Не удалось обработать изображение.");
  ctx.fillStyle = "#fff5f5";
  ctx.fillRect(0, 0, OUTPUT, OUTPUT);
  const sx = OUTPUT / innerW;
  const sy = OUTPUT / innerH;
  ctx.drawImage(
    source,
    (imgBox.left - frameBox.left - frame.clientLeft) * sx,
    (imgBox.top - frameBox.top - frame.clientTop) * sy,
    imgBox.width * sx,
    imgBox.height * sy,
  );
  return canvas.toDataURL("image/jpeg", 0.86);
}

/** Round preview in a dialog. Drag moves the photo, the slider changes its size. */
export function AvatarCrop({
  file,
  pending,
  onCancel,
  onSave,
}: {
  file: File;
  pending: boolean;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [framePx, setFramePx] = useState(FRAME);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [zoom, setZoom] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel, pending]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => setFramePx(node.clientWidth || FRAME);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let cancel = false;
    image.onload = () => {
      if (cancel) return;
      const place = frameOf(image, 0, 0, 0, FRAME);
      setLoaded({ image, zoom: place.coverZoom });
      setZoom(place.coverZoom);
      setPan({ x: 0, y: 0 });
    };
    image.onerror = () => {
      if (!cancel) setError("Не удалось прочитать изображение.");
    };
    image.src = url;
    return () => {
      cancel = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const place = loaded ? frameOf(loaded.image, zoom, pan.x, pan.y, framePx) : null;

  const dialog = (
    <div
      className="avatar-crop-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        className="avatar-crop-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="avatar-crop-title">Фото</h2>
        <div
          ref={frameRef}
          className="avatar-crop__frame"
          onPointerDown={(event) => {
            if (!place) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || !loaded) return;
            const next = frameOf(
              loaded.image,
              zoom,
              start.panX + event.clientX - start.x,
              start.panY + event.clientY - start.y,
              framePx,
            );
            setPan({
              x: next.x - (framePx - next.drawW) / 2,
              y: next.y - (framePx - next.drawH) / 2,
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {loaded && place ? (
            <img
              ref={imgRef}
              src={loaded.image.src}
              alt=""
              draggable={false}
              style={{ left: place.x, top: place.y, width: place.drawW, height: place.drawH }}
            />
          ) : null}
        </div>
        <p className="avatar-crop__hint">
          {error ?? "Потяните фото, чтобы сдвинуть. Ползунок меняет размер."}
        </p>
        <label className="avatar-crop__size">
          <span>Размер</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={zoom}
            aria-valuetext={zoom < (loaded?.zoom ?? 0) ? "меньше" : "больше"}
            disabled={!loaded || pending}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              setZoom(nextZoom);
              if (!loaded) return;
              const next = frameOf(loaded.image, nextZoom, pan.x, pan.y, framePx);
              setPan({
                x: next.x - (framePx - next.drawW) / 2,
                y: next.y - (framePx - next.drawH) / 2,
              });
            }}
          />
        </label>
        <div className="avatar-crop__actions">
          <button
            className="avatar-crop__save"
            type="button"
            disabled={!loaded || pending || Boolean(error)}
            onClick={() => {
              const frame = frameRef.current;
              const shown = imgRef.current;
              if (!loaded || !frame || !shown) return;
              onSave(paintVisible(shown, frame, shown));
            }}
          >
            {pending ? "Сохранение…" : "Сохранить фото"}
          </button>
          <button
            className="avatar-crop__cancel"
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
