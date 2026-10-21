import { useState } from "react";

import { authErrorMessage } from "@/lib/auth/errors";

type Slot = { key: string; src: string; pending: boolean };

async function fileToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      img.src = url;
    });
    const max = 960;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось обработать изображение.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function TrainerMediaField({
  initial,
  max,
  addLabel,
  doneLabel,
  onUpload,
  onRemove,
}: {
  initial: string[];
  max: number;
  addLabel: string;
  doneLabel: string;
  onUpload: (image: string) => Promise<string>;
  onRemove: (path: string) => Promise<void>;
}) {
  const [slots, setSlots] = useState<Slot[]>(() => initial.map((src) => ({ key: src, src, pending: false })));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="cabinet-media">
      {slots.length > 0 ? (
        <ul className="cabinet-photos">
          {slots.map((slot, index) => (
            <li key={slot.key} className={slot.pending ? "cabinet-photo is-pending" : "cabinet-photo"}>
              <img src={slot.src} alt="" />
              {index === 0 && addLabel === "Загрузить фото" ? <span>Главное</span> : null}
              <button
                type="button"
                className="cabinet-icon-btn cabinet-photo__remove"
                aria-label="Удалить"
                disabled={busy || slot.pending}
                onClick={() => {
                  setBusy(true);
                  setStatus("Удаление…");
                  void onRemove(slot.src.split("?")[0])
                    .then(() => {
                      setSlots((current) => current.filter((item) => item.key !== slot.key));
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
              setBusy(true);
              void (async () => {
                const room = max - slots.length;
                const batch = files.slice(0, room);
                for (let index = 0; index < batch.length; index += 1) {
                  const file = batch[index];
                  const key = `${Date.now()}-${index}-${file.name}`;
                  const preview = URL.createObjectURL(file);
                  setSlots((current) => [...current, { key, src: preview, pending: true }]);
                  setStatus(`Загрузка ${index + 1} из ${batch.length}`);
                  try {
                    const image = await fileToJpeg(file);
                    const stored = await onUpload(image);
                    setSlots((current) => current.map((item) => (item.key === key ? { key, src: stored, pending: false } : item)));
                  } catch (err: unknown) {
                    setSlots((current) => current.filter((item) => item.key !== key));
                    setStatus(authErrorMessage(err));
                    URL.revokeObjectURL(preview);
                    return;
                  }
                  URL.revokeObjectURL(preview);
                }
                setStatus(doneLabel);
              })().finally(() => setBusy(false));
            }}
          />
        </label>
      ) : null}
      <p className="cabinet-note" role="status">{status}</p>
    </div>
  );
}
