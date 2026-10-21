import { useRef, useState } from "react";

import { authErrorMessage } from "@/lib/auth/errors";
import {
  certificateCaption,
  MAX_TRAINER_CERTIFICATES,
  type TrainerCertificate,
} from "@/lib/catalog/certificate-file";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.doc,.docx,.txt";
const MAX_BYTES = 8_000_000;

type Slot = {
  key: string;
  path: string;
  caption: string;
  stored: string;
  name: string;
  pending: boolean;
  saved: boolean;
};

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

export function TrainerCertificatesField({
  initial,
  onUpload,
  onCaption,
  onRemove,
}: {
  initial: TrainerCertificate[];
  onUpload: (file: { name: string; dataUrl: string }, caption: string) => Promise<TrainerCertificate>;
  onCaption: (path: string, caption: string) => Promise<void>;
  onRemove: (path: string) => Promise<void>;
}) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    initial.map((item) => ({
      key: item.path,
      path: item.path.split("?")[0],
      caption: item.caption,
      stored: item.caption,
      name: item.path.split("?")[0].split("/").pop() || "Документ",
      pending: false,
      saved: false,
    })),
  );
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  function patch(key: string, partial: Partial<Slot>) {
    setSlots((current) => {
      const next = current.map((slot) => (slot.key === key ? { ...slot, ...partial } : slot));
      slotsRef.current = next;
      return next;
    });
  }

  return (
    <div className="cabinet-media">
      {slots.length > 0 ? (
        <ul className="cabinet-certs">
          {slots.map((slot) => (
            <li key={slot.key} className={["cabinet-cert", slot.pending ? "is-pending" : "", slot.saved ? "is-saved" : ""].filter(Boolean).join(" ")}>
              <label className="cabinet-cert__caption">
                <span>Подпись</span>
                <input
                  value={slot.caption}
                  maxLength={80}
                  disabled={busy || slot.pending}
                  onChange={(event) => patch(slot.key, { caption: event.target.value, saved: false })}
                  onBlur={() => {
                    const current = slotsRef.current.find((item) => item.key === slot.key);
                    if (!current?.path) return;
                    const caption = current.caption.trim();
                    if (!caption) {
                      patch(slot.key, { caption: current.stored || certificateCaption(current.name), saved: false });
                      setStatus("Подпись не может быть пустой.");
                      return;
                    }
                    if (caption === current.stored) return;
                    setBusy(true);
                    void onCaption(current.path, caption)
                      .then(() => {
                        patch(slot.key, { caption, stored: caption, saved: true });
                        setStatus("");
                      })
                      .catch((err: unknown) => setStatus(authErrorMessage(err)))
                      .finally(() => setBusy(false));
                  }}
                />
              </label>
              <a className="cabinet-cert__file" href={slot.path || undefined} target="_blank" rel="noopener noreferrer">
                {slot.pending ? "Загрузка…" : slot.name}
              </a>
              <button
                type="button"
                className="cabinet-icon-btn"
                aria-label="Удалить"
                disabled={busy || slot.pending}
                onClick={() => {
                  if (!slot.path) {
                    setSlots((current) => current.filter((item) => item.key !== slot.key));
                    return;
                  }
                  setBusy(true);
                  void onRemove(slot.path)
                    .then(() => {
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
      {slots.length < MAX_TRAINER_CERTIFICATES ? (
        <label className="cabinet-form__ghost">
          Загрузить документ
          <input
            type="file"
            accept={ACCEPT}
            multiple
            disabled={busy}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              const room = MAX_TRAINER_CERTIFICATES - slotsRef.current.length;
              if (files.length === 0 || room <= 0) return;
              const batch = files.slice(0, room);
              const oversized = batch.find((file) => file.size > MAX_BYTES);
              if (oversized) {
                setStatus("Файл больше 8 МБ.");
                return;
              }
              const pending = batch.map((file, index) => ({
                key: `${Date.now()}-${index}-${file.name}`,
                file,
                caption: certificateCaption(file.name),
              }));
              setSlots((current) => {
                const next = [
                  ...current,
                  ...pending.map((item) => ({
                    key: item.key,
                    path: "",
                    caption: item.caption,
                    stored: "",
                    name: item.file.name,
                    pending: true,
                    saved: false,
                  })),
                ];
                slotsRef.current = next;
                return next;
              });
              setBusy(true);
              setStatus(files.length > room ? `Можно добавить ещё ${room}.` : "");
              void (async () => {
                for (const item of pending) {
                  try {
                    const dataUrl = await readFile(item.file);
                    const caption = slotsRef.current.find((slot) => slot.key === item.key)?.caption.trim() || item.caption;
                    const stored = await onUpload({ name: item.file.name, dataUrl }, caption);
                    patch(item.key, {
                      path: stored.path.split("?")[0],
                      caption: stored.caption,
                      stored: stored.caption,
                      name: stored.path.split("?")[0].split("/").pop() || item.file.name,
                      pending: false,
                      saved: true,
                    });
                  } catch (err: unknown) {
                    setSlots((current) => {
                      const next = current.filter((slot) => slot.key !== item.key);
                      slotsRef.current = next;
                      return next;
                    });
                    setStatus(authErrorMessage(err));
                  }
                }
              })().finally(() => setBusy(false));
            }}
          />
        </label>
      ) : null}
      <p className="cabinet-note">Загружено {slots.filter((slot) => slot.path).length} из {MAX_TRAINER_CERTIFICATES}. PNG, JPG, PDF и другие файлы. Подпись станет текстом ссылки.</p>
      {status ? <p className="cabinet-note" role="status">{status}</p> : null}
    </div>
  );
}
