import { useEffect, useRef, useState } from "react";
import { BtnBold, BtnBulletList, BtnClearFormatting, BtnItalic, BtnNumberedList, Editor, EditorProvider, Toolbar, useEditorState } from "react-simple-wysiwyg";

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

export function MessageEditor({
  value,
  onChange,
  disabled,
  onSubmit,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="review-editor direct-editor">
      <EditorProvider>
        <Editor
          value={value}
          disabled={disabled}
          placeholder={disabled ? "Сообщения закрыты" : "Напишите сообщение"}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (event.shiftKey) {
              event.preventDefault();
              document.execCommand("insertLineBreak");
              return;
            }
            event.preventDefault();
            onSubmit();
          }}
        >
          <Toolbar>
            <BtnBold title="Жирный" aria-label="Жирный" />
            <BtnItalic title="Курсив" aria-label="Курсив" />
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
