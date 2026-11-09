import {
  BtnBold,
  BtnBulletList,
  BtnClearFormatting,
  BtnItalic,
  BtnNumberedList,
  Editor,
  EditorProvider,
  Toolbar,
} from "react-simple-wysiwyg";

import { pastedReviewHtml } from "@/lib/catalog/review-html";

function insertHtml(field: HTMLElement, html: string) {
  field.focus();
  if (document.execCommand("insertHTML", false, html)) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!field.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const template = document.createElement("template");
  template.innerHTML = html;
  const last = template.content.lastChild;
  range.insertNode(template.content);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

export function ReviewEditor({
  value,
  onChange,
  invalid = false,
  placeholder = "Как прошли занятия",
}: {
  value: string;
  onChange: (html: string) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={invalid ? "review-editor is-invalid" : "review-editor"}>
      <EditorProvider>
        <Editor
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={(event) => {
            const data = event.clipboardData;
            if (!data) return;
            const html = data.getData("text/html");
            const text = data.getData("text/plain");
            if (!html.trim() && !text) return;
            event.preventDefault();
            const clean = pastedReviewHtml(html, text);
            if (!clean) return;
            insertHtml(event.currentTarget, clean);
          }}
          placeholder={placeholder}
        >
          <Toolbar>
            <BtnBold title="Жирный" />
            <BtnItalic title="Курсив" />
            <BtnBulletList title="Список" />
            <BtnNumberedList title="Нумерованный список" />
            <BtnClearFormatting title="Убрать оформление" />
          </Toolbar>
        </Editor>
      </EditorProvider>
    </div>
  );
}
