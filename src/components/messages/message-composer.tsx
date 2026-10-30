import { useEffect, useRef, useState } from "react";

import { MessageEditor } from "@/components/messages/message-editor";
import { clientAttachmentIssue, composerBody, newMessageClientId } from "@/lib/messages/attachments";
import { reviewPlainText, reviewTextLength, sanitizeReviewHtml } from "@/lib/catalog/review-html";

export type ComposerFile = {
  id: string;
  file: File;
  name: string;
  kind: "image" | "file";
  url: string;
};

function namedFile(file: File) {
  if (file.name.trim()) return file;
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "png";
  return new File([file], `screenshot.${ext}`, { type: file.type || "image/png" });
}

export function MessageComposer({
  limit,
  disabled,
  hint,
  onSend,
}: {
  limit: number;
  disabled: boolean;
  hint?: string | null;
  onSend: (body: string, files: ComposerFile[]) => Promise<void>;
}) {
  const [html, setHtml] = useState("");
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const max = limit > 0 ? limit : 4000;
  const length = reviewTextLength(html);
  const over = length > max;
  const empty = reviewPlainText(html).length === 0 && files.length === 0;

  useEffect(() => () => {
    for (const item of filesRef.current) URL.revokeObjectURL(item.url);
  }, []);

  function addFiles(list: File[]) {
    const next = [...files];
    let error: string | null = null;
    for (const raw of list) {
      const file = namedFile(raw);
      const issue = clientAttachmentIssue(file, next.length);
      if (issue) {
        error = issue;
        if (issue.startsWith("Можно прикрепить не больше")) break;
        continue;
      }
      const kind = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name) ? "image" : "file";
      next.push({ id: newMessageClientId(), file, name: file.name, kind, url: URL.createObjectURL(file) });
    }
    setFiles(next);
    setFileError(error);
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
    const body = sanitizeReviewHtml(raw);
    const plain = reviewPlainText(body);
    if ((!plain && files.length === 0) || disabled || busy || over) return;
    setBusy(true);
    try {
      await onSend(plain ? body : "", files);
      for (const item of files) URL.revokeObjectURL(item.url);
      setHtml("");
      setFiles([]);
      setFileError(null);
    } finally {
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
      <div className="direct-composer__box">
        <MessageEditor
          value={html}
          onChange={setHtml}
          disabled={disabled || busy}
          onSubmit={(live) => void submit(live)}
          onAttach={addFiles}
        />
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
        <div className="direct-composer__bar">
          <button
            type="button"
            className="direct-composer__attach"
            aria-label="Прикрепить файл"
            title="Прикрепить файл или вставить скриншот (Ctrl+V)"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
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
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              addFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
          <p className={`direct-composer__count${over ? " is-over" : ""}`}>{length}/{max}</p>
          <button type="submit" className="direct-composer__send" title="Ctrl+Enter или ⌘+Enter" disabled={disabled || busy || over || empty}>
            {busy ? "…" : "Отправить"}
          </button>
        </div>
      </div>
    </form>
  );
}
