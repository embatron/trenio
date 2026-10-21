import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { PhotoImage } from "@/components/photo-image";
import { authErrorMessage } from "@/lib/auth/errors";

type Slot = { key: string; src: string; path: string; pending: boolean };

async function fileToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      img.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось обработать изображение.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function motionMs() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
}

type SlotCenter = { x: number; y: number };

/** Switch only when the pointer is clearly closer to another resting cell. */
function nearestSlot(centers: SlotCenter[], current: number, x: number, y: number) {
  const here = centers[current];
  if (!here) return current;
  let best = current;
  let bestDist = Math.hypot(x - here.x, y - here.y);
  centers.forEach((center, index) => {
    const dist = Math.hypot(x - center.x, y - center.y);
    if (dist + 36 < bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function storedImageLoads(src: string) {
  let delay = 120;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loaded = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
    if (loaded) return true;
    await sleep(delay);
    delay *= 2;
  }
  return false;
}

export function TrainerMediaField({
  initial,
  max,
  addLabel,
  doneLabel,
  onUpload,
  onRemove,
  onReorder,
  counter = false,
}: {
  initial: string[];
  max: number;
  addLabel: string;
  doneLabel: string;
  onUpload: (image: string) => Promise<string>;
  onRemove: (path: string) => Promise<void>;
  onReorder?: (paths: string[]) => Promise<void>;
  counter?: boolean;
}) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    initial.map((src) => ({ key: src, src, path: src.split("?")[0], pending: false })),
  );
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [liftKey, setLiftKey] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef(slots);
  const flipRef = useRef<Map<string, DOMRect> | null>(null);
  const settleRef = useRef<{ key: string; rect: DOMRect } | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const liftKeyRef = useRef<string | null>(null);
  slotsRef.current = slots;

  useEffect(() => {
    document.documentElement.classList.toggle("is-photo-drag", liftKey !== null);
    return () => document.documentElement.classList.remove("is-photo-drag");
  }, [liftKey]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const previous = flipRef.current;
    flipRef.current = null;
    if (list && previous) {
      for (const node of list.querySelectorAll<HTMLElement>("[data-key]")) {
        const key = node.dataset.key;
        if (!key || key === liftKeyRef.current) continue;
        const before = previous.get(key);
        if (!before) continue;
        const after = node.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        node.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: motionMs(), easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
      }
    }
    const settle = settleRef.current;
    settleRef.current = null;
    if (liftKeyRef.current) {
      const point = pointerRef.current;
      placeGhost(point.x - point.offsetX, point.y - point.offsetY);
    }
    if (!list || !settle) return;
    const node = list.querySelector<HTMLElement>(`[data-key="${CSS.escape(settle.key)}"]`);
    if (!node) return;
    const after = node.getBoundingClientRect();
    const dx = settle.rect.left - after.left;
    const dy = settle.rect.top - after.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.04)` },
        { transform: "translate(0, 0) scale(1)" },
      ],
      { duration: motionMs(), easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
  }, [slots, liftKey]);

  function placeGhost(x: number, y: number) {
    const node = ghostRef.current;
    if (!node) return;
    node.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
  }

  useLayoutEffect(() => {
    if (!liftKey) return;
    const point = pointerRef.current;
    placeGhost(point.x - point.offsetX, point.y - point.offsetY);
  }, [liftKey]);

  function shiftLifted(target: number) {
    const current = slotsRef.current;
    const from = current.findIndex((slot) => slot.key === liftKeyRef.current);
    if (from < 0 || from === target || !listRef.current) return false;
    for (const node of listRef.current.querySelectorAll<HTMLElement>("[data-key]")) {
      node.getAnimations().forEach((animation) => animation.finish());
    }
    const rects = new Map<string, DOMRect>();
    for (const node of listRef.current.querySelectorAll<HTMLElement>("[data-key]")) {
      if (node.dataset.key) rects.set(node.dataset.key, node.getBoundingClientRect());
    }
    flipRef.current = rects;
    const next = current.slice();
    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    slotsRef.current = next;
    setSlots(next);
    return true;
  }

  function persistOrder(next: Slot[], previous: Slot[]) {
    if (!onReorder || next.some((slot) => !slot.path)) return;
    if (next.every((slot, index) => slot.key === previous[index]?.key)) return;
    setBusy(true);
    if (!counter) setStatus("Сохранение порядка…");
    void onReorder(next.map((slot) => slot.path))
      .then(() => setStatus(counter ? "" : "Порядок сохранён."))
      .catch((err: unknown) => {
        if (listRef.current) {
          const rects = new Map<string, DOMRect>();
          for (const node of listRef.current.querySelectorAll<HTMLElement>("[data-key]")) {
            if (node.dataset.key) rects.set(node.dataset.key, node.getBoundingClientRect());
          }
          flipRef.current = rects;
        }
        slotsRef.current = previous;
        setSlots(previous);
        setStatus(authErrorMessage(err));
      })
      .finally(() => setBusy(false));
  }

  return (
    <div className="cabinet-media">
      {slots.length > 0 ? (
        <ul className="cabinet-photos" ref={listRef}>
          {slots.map((slot, index) => (
            <li
              key={slot.key}
              data-key={slot.key}
              className={[
                "cabinet-photo",
                slot.pending ? "is-pending" : "",
                onReorder ? "is-draggable" : "",
                liftKey === slot.key ? "is-placeholder" : "",
              ].filter(Boolean).join(" ")}
              onPointerDown={(event) => {
                if (!onReorder || busy || slot.pending || slots.some((item) => item.pending) || event.button !== 0) return;
                if ((event.target as HTMLElement).closest("button")) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const startX = event.clientX;
                const startY = event.clientY;
                const orderAtStart = slotsRef.current.map((item) => ({ ...item }));
                pointerRef.current = {
                  x: startX,
                  y: startY,
                  offsetX: startX - rect.left,
                  offsetY: startY - rect.top,
                };
                let lifted = false;
                let done = false;
                let indexNow = index;
                let centers: SlotCenter[] = [];
                const track = (ev: PointerEvent) => {
                  pointerRef.current.x = ev.clientX;
                  pointerRef.current.y = ev.clientY;
                  const dx = ev.clientX - startX;
                  const dy = ev.clientY - startY;
                  if (!lifted) {
                    if (dx * dx + dy * dy < 36) return;
                    const list = listRef.current;
                    if (!list) return;
                    for (const node of list.querySelectorAll<HTMLElement>("[data-key]")) {
                      node.getAnimations().forEach((animation) => animation.finish());
                    }
                    centers = [...list.children].map((node) => {
                      const rect = node.getBoundingClientRect();
                      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    });
                    lifted = true;
                    liftKeyRef.current = slot.key;
                    setLiftKey(slot.key);
                  }
                  const point = pointerRef.current;
                  placeGhost(point.x - point.offsetX, point.y - point.offsetY);
                  const target = nearestSlot(centers, indexNow, ev.clientX, ev.clientY);
                  if (target !== indexNow && shiftLifted(target)) indexNow = target;
                };
                const finish = () => {
                  if (done) return;
                  done = true;
                  window.removeEventListener("pointermove", track);
                  window.removeEventListener("pointerup", finish);
                  window.removeEventListener("pointercancel", finish);
                  if (lifted) {
                    const ghost = ghostRef.current?.getBoundingClientRect();
                    if (ghost) settleRef.current = { key: slot.key, rect: ghost };
                    liftKeyRef.current = null;
                    setLiftKey(null);
                    persistOrder(slotsRef.current, orderAtStart);
                  }
                };
                window.addEventListener("pointermove", track);
                window.addEventListener("pointerup", finish);
                window.addEventListener("pointercancel", finish);
              }}
            >
              {slot.src.startsWith("blob:") ? <img src={slot.src} alt="" /> : <PhotoImage src={slot.src} alt="" preset="tile" />}
              {index === 0 && addLabel === "Загрузить фото" ? <span>Главное</span> : null}
              <button
                type="button"
                className="cabinet-icon-btn cabinet-photo__remove"
                aria-label="Удалить"
                disabled={busy || slot.pending}
                onClick={() => {
                  setBusy(true);
                  if (!counter) setStatus("Удаление…");
                  void onRemove(slot.path)
                    .then(() => {
                      if (slot.src.startsWith("blob:")) URL.revokeObjectURL(slot.src);
                      setSlots((current) => {
                        const next = current.filter((item) => item.key !== slot.key);
                        slotsRef.current = next;
                        return next;
                      });
                      setStatus("");
                    })
                    .catch((err: unknown) => setStatus(authErrorMessage(err)))
                    .finally(() => setBusy(false));
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {liftKey ? (
        <div className="cabinet-photo is-ghost" ref={ghostRef} aria-hidden="true">
          {(() => {
            const lifted = slots.find((slot) => slot.key === liftKey);
            if (!lifted) return null;
            return lifted.src.startsWith("blob:") ? <img src={lifted.src} alt="" /> : <PhotoImage src={lifted.src} alt="" preset="tile" />;
          })()}
          {slots[0]?.key === liftKey && addLabel === "Загрузить фото" ? <span>Главное</span> : null}
        </div>
      ) : null}
      {slots.length < max ? (
        <label className="cabinet-form__ghost">
          {addLabel}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length === 0) return;
              const room = max - slotsRef.current.length;
              if (room <= 0) return;
              const batch = files.slice(0, room);
              const pending = batch.map((file, index) => {
                const key = `${Date.now()}-${index}-${file.name}`;
                const src = URL.createObjectURL(file);
                return { key, src, file };
              });
              setSlots((current) => {
                const accepted = pending.slice(0, Math.max(0, max - current.length));
                const next = [
                  ...current,
                  ...accepted.map((item) => ({ key: item.key, src: item.src, path: "", pending: true })),
                ];
                slotsRef.current = next;
                return next;
              });
              const accepted = pending.slice(0, room);
              setBusy(true);
              if (!counter) {
                setStatus(batch.length < files.length ? `Можно добавить ещё ${room}.` : `Загрузка 1 из ${batch.length}`);
              }
              void (async () => {
                let failed = false;
                for (let index = 0; index < accepted.length; index += 1) {
                  const item = accepted[index];
                  if (slotsRef.current.filter((slot) => slot.path).length >= max) {
                    URL.revokeObjectURL(item.src);
                    setSlots((current) => {
                      const next = current.filter((slot) => slot.key !== item.key);
                      slotsRef.current = next;
                      return next;
                    });
                    continue;
                  }
                  if (!counter) setStatus(`Загрузка ${index + 1} из ${accepted.length}`);
                  try {
                    const image = await fileToJpeg(item.file);
                    const stored = await onUpload(image);
                    if (!stored?.startsWith("/")) throw new Error("Не удалось сохранить фото.");
                    const path = stored.split("?")[0];
                    const shown = await storedImageLoads(stored);
                    setSlots((current) => {
                      const next = current.map((slot) =>
                        slot.key === item.key
                          ? { key: item.key, src: shown ? stored : slot.src, path, pending: false }
                          : slot,
                      );
                      slotsRef.current = next;
                      return next;
                    });
                    if (shown) URL.revokeObjectURL(item.src);
                  } catch (err: unknown) {
                    failed = true;
                    if (item.src.startsWith("blob:")) URL.revokeObjectURL(item.src);
                    setSlots((current) => {
                      const next = current.filter((slot) => slot.key !== item.key);
                      slotsRef.current = next;
                      return next;
                    });
                    setStatus(authErrorMessage(err));
                  }
                }
                if (!failed) setStatus(counter ? "" : doneLabel);
              })().finally(() => setBusy(false));
            }}
          />
        </label>
      ) : null}
      {counter ? <p className="cabinet-note">Загружено {slots.filter((slot) => slot.path).length} из {max}</p> : null}
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </div>
  );
}
