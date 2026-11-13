import { useEffect, useRef, useState } from "react";

import { DirectMark } from "@/components/messages/direct-mark";
import { ReplyIcon } from "@/components/messages/message-bubble";
import { MessageEditor } from "@/components/messages/message-editor";
import { clientAttachmentIssue, composerBody, newMessageClientId } from "@/lib/messages/attachments";
import { preparePastedFile } from "@/lib/messages/clipboard-images";
import { messageMarkup } from "@/lib/messages/markup";
import { reviewPlainText, reviewTextLength } from "@/lib/catalog/review-html";
import { prepareShellCamera } from "@/lib/native/shell";

export type ComposerFile = {
  id: string;
  file: File;
  name: string;
  kind: "image" | "file";
  url: string;
};

export function MessageComposer({
  limit,
  disabled,
  hint,
  editing = false,
  initialHtml = "",
  reply,
  onCancelReply,
  onCancelEdit,
  onSend,
  onActivity,
}: {
  limit: number;
  disabled: boolean;
  hint?: string | null;
  editing?: boolean;
  initialHtml?: string;
  reply?: { preview: string } | null;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  onSend: (body: string, files: ComposerFile[]) => Promise<void>;
  onActivity?: (typing: boolean) => void;
}) {
  const [html, setHtml] = useState(initialHtml);
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const pendingAdds = useRef(Promise.resolve());
  const max = limit > 0 ? limit : 4000;
  const length = reviewTextLength(html);
  const over = length > max;
  const empty = reviewPlainText(html).length === 0 && files.length === 0;

  useEffect(() => () => {
    for (const item of filesRef.current) URL.revokeObjectURL(item.url);
  }, []);

  function addFiles(list: File[]) {
    pendingAdds.current = pendingAdds.current.then(async () => {
      const next = [...filesRef.current];
      let error: string | null = null;
      for (const raw of list) {
        const file = await preparePastedFile(raw);
        const issue = clientAttachmentIssue(file, next.length);
        if (issue) {
          error = issue;
          if (issue.startsWith("Можно прикрепить не больше")) break;
          continue;
        }
        const kind = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name) ? "image" : "file";
        next.push({ id: newMessageClientId(), file, name: file.name, kind, url: URL.createObjectURL(file) });
      }
      filesRef.current = next;
      setFiles(next);
      setFileError(error);
    }).catch(() => undefined);
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const item = current.find((file) => file.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter((file) => file.id !== id);
    });
    setFileError(null);
  }

  async function submit(liveHtml?: string) {
    const raw = composerBody(liveHtml, html);
    const body = messageMarkup(raw);
    const plain = reviewPlainText(body);
    if ((!plain && files.length === 0) || disabled || busy || sending.current || over) return;
    const sentFiles = files;
    sending.current = true;
    setHtml("");
    setFiles([]);
    onActivity?.(false);
    setFileError(null);
    setBusy(true);
    try {
      await onSend(plain ? body : "", sentFiles);
      for (const item of sentFiles) URL.revokeObjectURL(item.url);
    } catch (error) {
      setHtml((current) => (reviewPlainText(current).length > 0 ? current : body));
      setFiles((current) => (current.length > 0 ? current : sentFiles));
      throw error;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      className="direct-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {hint ? <p className="direct-composer__hint">{hint}</p> : null}
      {fileError ? <p className="direct-composer__hint">{fileError}</p> : null}
      {reply ? (
        <div className="direct-banner direct-banner--quote">
          <ReplyIcon />
          <span>{reply.preview}</span>
          <button type="button" onClick={onCancelReply} aria-label="Убрать цитату">×</button>
        </div>
      ) : null}
      {editing ? (
        <div className="direct-banner">
          <span>Редактирование</span>
          <button type="button" onClick={onCancelEdit} aria-label="Отменить правку">×</button>
        </div>
      ) : null}
      {files.length > 0 ? (
        <ul className="direct-draft">
          {files.map((file) => (
            <li key={file.id} className={file.kind === "image" ? "is-image" : undefined}>
              {file.kind === "image" ? <img src={file.url} alt={file.name} /> : <span>{file.name}</span>}
              <button type="button" onClick={() => removeFile(file.id)} aria-label={`Убрать ${file.name}`}>
                {file.kind === "image" ? "×" : "Убрать"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {over || length > max - 80 ? (
        <p className={`direct-composer__count${over ? " is-over" : ""}`}>{length}/{max}</p>
      ) : null}
      <div className="direct-composer__row">
        <button
          type="button"
          className="direct-composer__attach"
          aria-label="Прикрепить файл"
          disabled={disabled || busy || editing}
          onClick={() => {
            void prepareShellCamera().finally(() => input.current?.click());
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.5 7.2v8.1a3.5 3.5 0 0 1-7 0V6.4a2.3 2.3 0 0 1 4.6 0v8.2a1.1 1.1 0 0 1-2.2 0V7.4" />
          </svg>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,application/pdf,.pdf"
          onChange={(event) => {
            addFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <div className="direct-composer__pill">
          <MessageEditor
            value={html}
            maxLength={max}
            onChange={(value) => {
              setHtml(value);
              onActivity?.(reviewPlainText(value).trim().length > 0);
            }}
            disabled={disabled}
            onSubmit={(live) => void submit(live)}
            onAttach={addFiles}
          />
        </div>
        <button type="submit" className="direct-composer__send" aria-label={editing ? "Сохранить" : "Отправить"} disabled={disabled || busy || over || empty}>
          {busy ? "…" : editing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" /></svg>
          ) : (
            <DirectMark />
          )}
        </button>
      </div>
    </form>
  );
}
