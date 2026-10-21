import { BtnBold, BtnBulletList, BtnClearFormatting, BtnItalic, BtnNumberedList, Editor, EditorProvider, Toolbar } from "react-simple-wysiwyg";

export function ReviewEditor({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (html: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className={invalid ? "review-editor is-invalid" : "review-editor"}>
      <EditorProvider>
      <Editor value={value} onChange={(event) => onChange(event.target.value)} placeholder="Как прошли занятия">
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
