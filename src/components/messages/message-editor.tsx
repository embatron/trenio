import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { markerEndingAt, renderMessageMarkers } from "@/lib/messages/markup";

const EmojiPanel = lazy(() => import("@/components/messages/emoji-panel"));

const TAG: Record<string, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strike: "s",
  code: "code",
  pre: "pre",
  spoiler: "span",
};

function filesFromClipboard(data: DataTransfer | null) {
  if (!data) return [];
  const listed = [...data.files];
  if (listed.length > 0) return listed;
  const files: File[] = [];
  for (const item of data.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

function applyClosedMarker(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || selection.rangeCount === 0) return;
  const node = selection.anchorNode;
  if (!(node instanceof Text) || !root.contains(node)) return;
  if (node.parentElement?.closest("code, pre")) return;
  const found = markerEndingAt(node.data, selection.anchorOffset);
  if (!found || found.kind === "link") return;
  const before = node.data.slice(0, found.start);
  const after = node.data.slice(found.end);
  const inner = node.data.slice(found.contentStart, found.contentEnd);
  const element = document.createElement(TAG[found.kind] ?? "span");
  if (found.kind === "spoiler") element.className = "tg-spoiler";
  if (found.kind === "code" || found.kind === "pre") element.textContent = inner;
  else element.innerHTML = renderMessageMarkers(inner);
  const parent = node.parentNode;
  if (!parent) return;
  const fragment = document.createDocumentFragment();
  if (before) fragment.append(document.createTextNode(before));
  fragment.append(element);
  let caret: { node: Text; offset: number } | null = null;
  if (after) {
    const afterNode = document.createTextNode(after);
    fragment.append(afterNode);
    caret = { node: afterNode, offset: 0 };
  }
  parent.replaceChild(fragment, node);
  const range = document.createRange();
  if (caret) range.setStart(caret.node, caret.offset);
  else range.setStartAfter(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertText(field: HTMLElement, text: string) {
  field.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  if (selection && selection.rangeCount > 0 && field.contains(selection.anchorNode)) {
    const current = selection.getRangeAt(0);
    current.deleteContents();
    range.setStart(current.startContainer, current.startOffset);
  } else {
    range.selectNodeContents(field);
    range.collapse(false);
  }
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

export function MessageEditor({
  value,
  onChange,
  disabled,
  onSubmit,
  onAttach,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled: boolean;
  onSubmit: (html: string) => void;
  onAttach: (files: File[]) => void;
}) {
  const field = useRef<HTMLDivElement>(null);
  const [emoji, setEmoji] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef(onAttach);
  attachRef.current = onAttach;
  const placeholder = disabled ? "Сообщения закрыты" : "Написать сообщение";
  const empty = value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;

  useEffect(() => {
    const el = field.current;
    if (!el || el.innerHTML === value) return;
    el.innerHTML = value;
  }, [value]);

  useEffect(() => {
    if (!emoji) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (box.current?.contains(target) || panelRef.current?.contains(target)) return;
      setEmoji(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setEmoji(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [emoji]);

  function publish() {
    const el = field.current;
    if (!el) return;
    applyClosedMarker(el);
    onChange(el.innerHTML);
  }

  return (
    <>
    <div className="direct-field-wrap" ref={box}>
      {empty ? <span className="direct-field__placeholder" aria-hidden="true">{placeholder}</span> : null}
      <div
        ref={field}
        className="direct-field"
        contentEditable={disabled ? "false" : "true"}
        role="textbox"
        aria-multiline="true"
        aria-disabled={disabled}
        aria-label={placeholder}
        onInput={() => publish()}
        onPaste={(event) => {
          const files = filesFromClipboard(event.clipboardData);
          if (files.length > 0) {
            event.preventDefault();
            attachRef.current(files);
            return;
          }
          const text = event.clipboardData?.getData("text/plain");
          if (text == null) return;
          event.preventDefault();
          const el = field.current;
          if (el) insertText(el, text);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.repeat || event.shiftKey || event.altKey) return;
          if (!event.ctrlKey && !event.metaKey) return;
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          const el = field.current;
          if (!el) return;
          applyClosedMarker(el);
          onChange(el.innerHTML);
          onSubmit(el.innerHTML);
        }}
      />
      <button
        type="button"
        className="direct-emoji"
        aria-label="Эмодзи"
        aria-expanded={emoji}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setEmoji((open) => !open)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 14.2c.8 1 2.1 1.6 3.5 1.6s2.7-.6 3.5-1.6" />
          <path d="M9 10h.01M15 10h.01" />
        </svg>
      </button>
    </div>
    {emoji ? (
      <div className="direct-emoji__panel" ref={panelRef} role="dialog" aria-label="Эмодзи">
        <Suspense fallback={null}>
          <EmojiPanel onPick={(glyph) => {
            const el = field.current;
            if (el) insertText(el, glyph);
            setEmoji(false);
          }} />
        </Suspense>
      </div>
    ) : null}
    </>
  );
}
