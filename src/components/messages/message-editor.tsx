import { useEffect, useRef, useState } from "react";
import { BtnBulletList, BtnClearFormatting, BtnNumberedList, Editor, EditorProvider, Toolbar, useEditorState } from "react-simple-wysiwyg";

import { EMOJI_GROUPS } from "@/lib/emoji-catalog";

function EmojiControl({ onChange }: { onChange: (html: string) => void }) {
  const editor = useEditorState();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(EMOJI_GROUPS[0].id);
  const box = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const active = EMOJI_GROUPS.find((item) => item.id === group) ?? EMOJI_GROUPS[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function remember() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.$el) return;
    const next = selection.getRangeAt(0);
    if (next.startContainer === editor.$el || editor.$el.contains(next.startContainer)) range.current = next.cloneRange();
  }

  function insert(emoji: string) {
    const field = editor.$el;
    if (!field) return;
    field.focus();
    const selection = window.getSelection();
    let target = range.current;
    if (!target || (target.startContainer !== field && !field.contains(target.startContainer))) {
      target = document.createRange();
      target.selectNodeContents(field);
      target.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(target);
    target.deleteContents();
    const node = document.createTextNode(emoji);
    target.insertNode(node);
    target.setStartAfter(node);
    target.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(target);
    range.current = target.cloneRange();
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    onChange(field.innerHTML);
  }

  return (
    <div className="emoji-picker" ref={box}>
      <button
        type="button"
        className="rsw-btn"
        aria-label="Эмодзи"
        aria-expanded={open}
        title="Эмодзи"
        onPointerDown={(event) => {
          event.preventDefault();
          remember();
          setOpen((value) => !value);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 14.2c.8 1 2.1 1.6 3.5 1.6s2.7-.6 3.5-1.6" />
          <path d="M9 10h.01M15 10h.01" />
        </svg>
      </button>
      {open ? (
        <div className="emoji-picker__panel" role="dialog" aria-label="Выбор эмодзи">
          <div className="emoji-picker__tabs" role="tablist">
            {EMOJI_GROUPS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === active.id}
                aria-label={item.label}
                title={item.label}
                className={item.id === active.id ? "is-active" : undefined}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setGroup(item.id);
                }}
              >
                {item.glyph}
              </button>
            ))}
          </div>
          <div className="emoji-picker__grid" role="tabpanel" aria-label={active.label}>
            {active.emoji.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                onPointerDown={(event) => {
                  event.preventDefault();
                  insert(emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const iconStyle = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "var(--icon-stroke)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function LineIcon({ paths }: { paths: string[] }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} style={iconStyle} />
      ))}
    </svg>
  );
}

function selectionHas(root: HTMLElement | null | undefined, tags: readonly string[]) {
  if (!root) return false;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  let node: Node | null = selection.anchorNode;
  if (!node || (node !== root && !root.contains(node))) return false;
  const want = new Set(tags);
  while (node && node !== root) {
    if (node instanceof HTMLElement && want.has(node.tagName)) return true;
    node = node.parentNode;
  }
  return false;
}

function FormatButton({
  label,
  command,
  tags,
  paths,
}: {
  label: string;
  command: string;
  tags: readonly string[];
  paths: string[];
}) {
  const editor = useEditorState();
  const focused = Boolean(editor.$el?.contains(document.activeElement));
  const active = focused && selectionHas(editor.$el, tags);
  return (
    <button
      type="button"
      className="rsw-btn"
      data-active={active}
      aria-pressed={active}
      aria-label={label}
      title={label}
      tabIndex={-1}
      onMouseDown={(event) => {
        event.preventDefault();
        if (!editor.$el?.contains(document.activeElement)) editor.$el?.focus();
        document.execCommand(command);
      }}
    >
      <LineIcon paths={paths} />
    </button>
  );
}

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
  const attachRef = useRef(onAttach);
  attachRef.current = onAttach;
  return (
    <div className="review-editor direct-editor">
      <EditorProvider>
        <Editor
          value={value}
          disabled={disabled}
          placeholder={disabled ? "Сообщения закрыты" : "Напишите сообщение"}
          onChange={(event) => onChange(event.target.value)}
          onPaste={(event) => {
            const files = filesFromClipboard(event.clipboardData);
            if (files.length === 0) return;
            event.preventDefault();
            attachRef.current(files);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.repeat || event.shiftKey || event.altKey) return;
            if (!event.ctrlKey && !event.metaKey) return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            const field = event.currentTarget as HTMLElement;
            onChange(field.innerHTML);
            onSubmit(field.innerHTML);
          }}
        >
          <Toolbar>
            <FormatButton label="Жирный" command="bold" tags={["B", "STRONG"]} paths={["M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"]} />
            <FormatButton label="Курсив" command="italic" tags={["I", "EM"]} paths={["M19 4h-9", "M14 20H5", "M15 4 9 20"]} />
            <BtnBulletList title="Список" aria-label="Список" />
            <BtnNumberedList title="Нумерованный список" aria-label="Нумерованный список" />
            <BtnClearFormatting title="Убрать оформление" aria-label="Убрать оформление" />
            <EmojiControl onChange={onChange} />
          </Toolbar>
        </Editor>
      </EditorProvider>
    </div>
  );
}
