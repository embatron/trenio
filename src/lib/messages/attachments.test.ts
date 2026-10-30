import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTACHMENT_BAD_TYPE,
  ATTACHMENT_TOO_BIG,
  ATTACHMENT_TOO_MANY,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  clientAttachmentIssue,
  composerBody,
  newMessageClientId,
  sniffAttachment,
} from "@/lib/messages/attachments";
import { sendMessageSchema } from "@/lib/messages/schemas";

function bytes(signature: number[], extra = "") {
  const tail = new TextEncoder().encode(extra);
  const out = new Uint8Array(signature.length + tail.length);
  out.set(signature, 0);
  out.set(tail, signature.length);
  return out;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

test("a message id is a uuid when randomUUID is missing", () => {
  const source = globalThis.crypto;
  const original = source.randomUUID;
  Object.defineProperty(source, "randomUUID", { value: undefined, configurable: true });
  try {
    assert.match(newMessageClientId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    Object.defineProperty(source, "randomUUID", { value: original, configurable: true });
  }
});

test("Enter sends the text that is already in the editor", () => {
  assert.equal(composerBody("Уже на экране", ""), "Уже на экране");
  assert.equal(composerBody("<p><br></p>", "из состояния"), "из состояния");
  assert.equal(composerBody(undefined, "из состояния"), "из состояния");
});

test("a screenshot png is an image and a renamed executable is not", () => {
  const png = sniffAttachment(bytes(PNG), "image.png", "image/png");
  assert.equal(png.ok, true);
  if (png.ok) {
    assert.equal(png.file.ext, "png");
    assert.equal(png.file.kind, "image");
  }
  const lie = sniffAttachment(bytes(PNG), "photo.exe", "image/png");
  assert.equal(lie.ok, false);
  if (!lie.ok) assert.equal(lie.message, ATTACHMENT_BAD_TYPE);
});

test("documents are accepted only when the bytes match the extension", () => {
  assert.equal(sniffAttachment(bytes([0x25, 0x50, 0x44, 0x46, 0x2d]), "sheet.pdf", "application/pdf").ok, true);
  assert.equal(sniffAttachment(bytes(OLE), "diploma.doc", "application/msword").ok, true);
  assert.equal(sniffAttachment(bytes(OLE), "table.xls", "application/vnd.ms-excel").ok, true);
  const docx = sniffAttachment(bytes(ZIP, "word/document.xml"), "notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(docx.ok && docx.file.ext, "docx");
  const xlsx = sniffAttachment(bytes(ZIP, "xl/workbook.xml"), "plan.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(xlsx.ok && xlsx.file.ext, "xlsx");
  assert.equal(sniffAttachment(bytes(ZIP, "word/document.xml"), "plan.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").ok, false);
  assert.equal(sniffAttachment(bytes([0x3c, 0x68, 0x74, 0x6d, 0x6c]), "page.html", "text/html").ok, false);
});

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

test("a message may be files without text, and ten files are refused", () => {
  const parsed = sendMessageSchema.parse({ conversationId: id, clientId: other, attachmentIds: [id] });
  assert.equal(parsed.body, "");
  assert.equal(parsed.attachmentIds.length, 1);
  assert.throws(() => sendMessageSchema.parse({ conversationId: id, clientId: other, body: "   ", attachmentIds: [] }));
  assert.throws(() => sendMessageSchema.parse({
    conversationId: id,
    clientId: other,
    attachmentIds: Array.from({ length: 10 }, () => id),
  }));
});

test("the tenth file and a file over 2 MiB are refused", () => {
  assert.equal(clientAttachmentIssue({ name: "a.png", type: "image/png", size: 10 }, 9), ATTACHMENT_TOO_MANY);
  assert.equal(clientAttachmentIssue({ name: "a.png", type: "image/png", size: MESSAGE_ATTACHMENT_MAX_BYTES + 1 }, 0), ATTACHMENT_TOO_BIG);
  assert.equal(clientAttachmentIssue({ name: "a.png", type: "image/png", size: MESSAGE_ATTACHMENT_MAX_BYTES }, 8), null);
  const huge = new Uint8Array(MESSAGE_ATTACHMENT_MAX_BYTES + 1);
  huge.set(PNG);
  const sniffed = sniffAttachment(huge, "big.png", "image/png");
  assert.equal(sniffed.ok, false);
  if (!sniffed.ok) assert.equal(sniffed.message, ATTACHMENT_TOO_BIG);
});
