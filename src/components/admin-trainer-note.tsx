import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { getTrainerStaffNotesFn, saveTrainerStaffNoteFn, type TrainerStaffNote } from "@/lib/admin/trainers";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

const CLOSE_ICON = "M6 6l12 12M18 6L6 18";
const NOTE_PAGE = "M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z";
const NOTE_FOLD = "M15 3v6h6";

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function TrainerNoteCell({
  slug,
  name,
  note,
  count,
  onSaved,
}: {
  slug: string;
  name: string;
  note: string;
  count: number;
  onSaved: (note: string, at: string, count: number) => void;
}) {
  const [shown, setShown] = useState(count);
  useEffect(() => setShown(count), [count]);
  const [open, setOpen] = useState(false);
  const label = shown > 0 ? `Заметка, записей: ${shown}` : "Заметка";
  return (
    <>
      <button
        type="button"
        className={shown > 0 ? "cabinet-icon-btn trainer-note-link is-filled" : "cabinet-icon-btn trainer-note-link"}
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={NOTE_PAGE} />
          <path d={NOTE_FOLD} />
        </svg>
      </button>
      {open ? (
        <TrainerNoteDialog
          slug={slug}
          name={name}
          initial={note}
          onClose={() => setOpen(false)}
          onSaved={onSaved}
          onCount={setShown}
        />
      ) : null}
    </>
  );
}

function TrainerNoteDialog({
  slug,
  name,
  initial,
  onClose,
  onSaved,
  onCount,
}: {
  slug: string;
  name: string;
  initial: string;
  onClose: () => void;
  onSaved: (note: string, at: string, count: number) => void;
  onCount: (count: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const load = useAuthServerFn(getTrainerStaffNotesFn);
  const save = useAuthServerFn(saveTrainerStaffNoteFn);
  const [body, setBody] = useState(initial);
  const [history, setHistory] = useState<TrainerStaffNote[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [savedBy, setSavedBy] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    let cancelled = false;
    void load({ data: { slug } })
      .then((notes) => {
        if (!cancelled) {
          setHistory(notes);
          onCount(notes.length);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(authErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [load, slug]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await save({ data: { slug, body } });
      setHistory(result.notes);
      setBody(result.note);
      onSaved(result.note, result.at, result.notes.length);
      setSavedBy(result.notes[0]?.author || "сотрудника");
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="trainer-note-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <button type="button" className="cabinet-icon-btn trainer-note-dialog__close" aria-label="Закрыть" onClick={() => dialogRef.current?.close()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={CLOSE_ICON} /></svg>
      </button>
      <h2 id={titleId}>Заметка: {name}</h2>
      <form onSubmit={onSubmit}>
        <textarea
          value={body}
          maxLength={4000}
          rows={5}
          aria-label="Текст заметки"
          placeholder="Заметка видна только сотрудникам"
          onChange={(event) => setBody(event.target.value)}
        />
        {error ? <p className="auth-alert" role="alert">{error}</p> : null}
        <div className="trainer-note-dialog__actions">
          <button type="submit" className="trainer-note-dialog__save" disabled={pending}>{pending ? "Сохраняю…" : "Сохранить"}</button>
        </div>
      </form>
      {history.length > 0 ? (
        <ol className="trainer-note-history">
          {history.map((item) => (
            <li key={item.id}>
              <span>Заметка от {item.author} · {dateTime.format(new Date(item.createdAt))}</span>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {savedBy ? (
        <div className="cabinet-modal" onClick={() => setSavedBy("")}>
          <div className="cabinet-modal__card" role="alertdialog" aria-labelledby="trainer-note-saved" onClick={(event) => event.stopPropagation()}>
            <h2 id="trainer-note-saved">Заметка сохранена</h2>
            <p>Заметка от {savedBy}</p>
            <button type="button" onClick={() => setSavedBy("")}>Закрыть</button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
