import { useEffect, useState } from "react";

import { absoluteUrl } from "@/lib/seo/site";

const SHARE_NODES = [
  { cx: 18, cy: 5 },
  { cx: 6, cy: 12 },
  { cx: 18, cy: 19 },
] as const;

let notify: ((id: number) => void) | null = null;

function showCopiedLink() {
  notify?.(Date.now());
}

function writeClipboard(text: string) {
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.focus();
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    if (ok) return true;
  } catch {
    // Fall through to the async clipboard.
  }
  if (!navigator.clipboard?.writeText) return false;
  void navigator.clipboard.writeText(text).then(
    () => showCopiedLink(),
    () => undefined,
  );
  return false;
}

export function ShareProfileButton({ slug, className }: { slug: string; className: string }) {
  return (
    <button
      type="button"
      className={className}
      aria-label="Скопировать ссылку на профиль"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (writeClipboard(absoluteUrl(`/trainers/${slug}`))) showCopiedLink();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {SHARE_NODES.map((node) => (
          <circle key={`${node.cx}-${node.cy}`} cx={node.cx} cy={node.cy} r="2.15" />
        ))}
        <path d="M8.15 10.85 15.85 6.35M8.15 13.15l7.7 4.5" />
      </svg>
    </button>
  );
}

/** Green confirmation that slides up from the bottom and leaves on its own. */
export function CopyLinkToast() {
  const [toast, setToast] = useState<{ id: number } | null>(null);

  useEffect(() => {
    notify = (id) => setToast({ id });
    return () => {
      notify = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 1480);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <p key={toast.id} className="copy-toast" role="status">
      Скопирована ссылка
    </p>
  );
}
