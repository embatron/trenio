import { lazy, Suspense, memo, useEffect, useLayoutEffect, useRef, useState } from "react";

import { reviewTextLength } from "@/lib/catalog/review-html";
import {
  MESSAGE_BREAK_CAP,
  MESSAGE_BREAK_RUN,
  clipPlainMessage,
  collapsePlainBreaks,
  messageBreaksNeedTighten,
  plainToEditorHtml,
} from "@/lib/messages/breaks";
import {
  clipboardFiles,
  clipboardSuggestsImage,
  fileFromDataUrl,
  filesFromHtmlImages,
} from "@/lib/messages/clipboard-images";
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

function placeCaretAtEnd(field: HTMLElement) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function breaksBeforeCaret(field: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || selection.rangeCount === 0) return 0;
  const node = selection.anchorNode;
  if (!node || !field.contains(node)) return 0;
  let current: Node | null = node;
  let offset = selection.anchorOffset;
  let count = 0;
  if (current instanceof Text) {
    const before = current.data.slice(0, offset).replace(/\u200b/g, "");
    if (before.length > 0) return (before.match(/\n+$/)?.[0].length ?? 0);
    current = current.previousSibling;
  } else if (current instanceof HTMLElement) {
    current = current.childNodes[offset - 1] ?? null;
  }
  while (current) {
    if (current instanceof HTMLBRElement) count += 1;
    else if (current instanceof Text && current.data.replace(/\u200b|\n/g, "") === "") count += (current.data.match(/\n/g) ?? []).length;
    else break;
    current = current.previousSibling;
  }
  return count;
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

export const MessageEditor = memo(function MessageEditor({
  value,
  maxLength,
  onChange,
  disabled,
  onSubmit,
  onAttach,
}: {
  value: string;
  maxLength: number;
  onChange: (html: string) => void;
  disabled: boolean;
  onSubmit: (html: string) => void;
  onAttach: (files: File[]) => void;
}) {
  const field = useRef<HTMLDivElement>(null);
  const keyedEnter = useRef(0);
  const stick = useRef(false);
  const written = useRef<string | null>(null);
  const tookPaste = useRef(0);
  const [emoji, setEmoji] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef(onAttach);
  attachRef.current = onAttach;
  const placeholder = disabled ? "Сообщения закрыты" : "Написать сообщение";
  const empty = value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;

  useLayoutEffect(() => {
    const el = field.current;
    if (!el || disabled) return;
    const focused = document.activeElement === el;
    if (el.innerHTML !== value) {
      const draft = el.innerText.replace(/\u200b/g, "").trim();
      const typingAhead = focused && value === "" && written.current === "" && draft.length > 0;
      if (!typingAhead) {
        el.innerHTML = value;
        written.current = value;
        if (stick.current || focused) {
          el.focus();
          placeCaretAtEnd(el);
        }
      }
    } else {
      written.current = value;
    }
    if (!stick.current) return;
    if (document.activeElement !== el) el.focus();
    if (!el.contains(window.getSelection()?.anchorNode ?? null)) placeCaretAtEnd(el);
  });

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && field.current?.contains(target)) return;
      stick.current = false;
    }
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, []);

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

  function giveFiles(files: File[]) {
    if (files.length === 0) return;
    if (performance.now() - tookPaste.current < 300) return;
    tookPaste.current = performance.now();
    attachRef.current(files);
    field.current?.focus();
  }

  async function liftInsertedImages(el: HTMLElement) {
    const images = [...el.querySelectorAll("img")];
    if (images.length === 0) return;
    const srcs = images.map((img) => img.getAttribute("src") ?? "");
    for (const img of images) img.remove();
    if (performance.now() - tookPaste.current < 500) return;
    const files: File[] = [];
    for (const src of srcs) {
      if (src.startsWith("data:image/")) {
        const file = fileFromDataUrl(src);
        if (file) files.push(file);
        continue;
      }
      if (!src.startsWith("blob:")) continue;
      try {
        const blob = await (await fetch(src)).blob();
        if (!blob.type.startsWith("image/") || blob.size <= 0) continue;
        files.push(new File([blob], "screenshot.png", { type: blob.type || "image/png" }));
      } catch {
        // The browser kept a picture we cannot read back.
      }
    }
    giveFiles(files);
  }

  function publish() {
    const el = field.current;
    if (!el) return;
    const brs = el.querySelectorAll("br").length;
    if (brs > MESSAGE_BREAK_CAP || messageBreaksNeedTighten(el.innerHTML)) {
      el.innerHTML = plainToEditorHtml(clipPlainMessage(el.innerText, maxLength));
      placeCaretAtEnd(el);
    }
    applyClosedMarker(el);
    onChange(el.innerHTML);
  }

  function insertBreak() {
    const el = field.current;
    if (!el || disabled) return;
    const breaks = (el.innerText.match(/\n/g) ?? []).length;
    if (breaks >= MESSAGE_BREAK_CAP || breaksBeforeCaret(el) >= MESSAGE_BREAK_RUN) return;
    if (reviewTextLength(el.innerHTML) >= maxLength) return;
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
      const current = selection.getRangeAt(0);
      current.deleteContents();
      range.setStart(current.startContainer, current.startOffset);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }
    const br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  function sendFromField() {
    const el = field.current;
    if (!el || disabled) return;
    applyClosedMarker(el);
    stick.current = true;
    onChange(el.innerHTML);
    onSubmit(el.innerHTML);
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
        onInput={() => {
          const el = field.current;
          if (!el || !el.querySelector("img")) {
            publish();
            return;
          }
          void liftInsertedImages(el).finally(() => publish());
        }}
        onBlur={() => {
          setTimeout(() => {
            if (document.activeElement !== field.current) stick.current = false;
          }, 0);
        }}
        onPaste={(event) => {
          const data = event.clipboardData;
          const files = clipboardFiles(data);
          if (files.length > 0) {
            event.preventDefault();
            giveFiles(files);
            return;
          }
          const htmlFiles = filesFromHtmlImages(data?.getData("text/html") ?? "");
          if (htmlFiles.length > 0) {
            event.preventDefault();
            giveFiles(htmlFiles);
            return;
          }
          const types = [...(data?.types ?? [])];
          if (clipboardSuggestsImage(types)) {
            if (window.isSecureContext && navigator.clipboard?.read) {
              event.preventDefault();
              void navigator.clipboard.read().then(async (items) => {
                const images: File[] = [];
                for (const item of items) {
                  const type = item.types.find((entry) => entry.startsWith("image/"));
                  if (!type) continue;
                  const blob = await item.getType(type);
                  if (blob.size <= 0) continue;
                  images.push(new File([blob], "screenshot.png", { type: blob.type || type }));
                }
                giveFiles(images);
              }).catch(() => undefined);
            }
            return;
          }
          const text = data?.getData("text/plain");
          if (text == null) return;
          event.preventDefault();
          const el = field.current;
          if (!el || !text) return;
          const room = Math.max(0, maxLength - reviewTextLength(el.innerHTML));
          insertText(el, clipPlainMessage(collapsePlainBreaks(text), room));
        }}
        onBeforeInput={(event) => {
          const type = event.nativeEvent.inputType;
          if ((type === "insertParagraph" || type === "insertLineBreak") && performance.now() - keyedEnter.current < 50) {
            event.preventDefault();
            return;
          }
          if (type === "insertParagraph") {
            event.preventDefault();
            if (!event.nativeEvent.isComposing) sendFromField();
            return;
          }
          if (type === "insertLineBreak") {
            event.preventDefault();
            insertBreak();
            return;
          }
          if (!type.startsWith("insert") || type === "insertCompositionText") return;
          const el = field.current;
          if (el && reviewTextLength(el.innerHTML) >= maxLength) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          keyedEnter.current = performance.now();
          if (event.shiftKey || event.altKey) {
            event.preventDefault();
            insertBreak();
            return;
          }
          event.preventDefault();
          if (event.repeat) return;
          sendFromField();
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
}, (prev, next) => prev.value === next.value && prev.disabled === next.disabled && prev.maxLength === next.maxLength);
