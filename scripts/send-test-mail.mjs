#!/usr/bin/env node
/**
 * Two plain test letters through local Postfix.
 * Usage: node --env-file=.env scripts/send-test-mail.mjs
 */
import { spawn } from "node:child_process";

const to = "embatron@gmail.com";
const from = process.env.MAIL_FROM?.trim() || "Trenio <trenioby@gmail.com>";
const sendmail = process.env.SENDMAIL_PATH?.trim() || "/usr/sbin/sendmail";
const envelope = from.match(/<([^>]+)>/)?.[1]?.trim() || from;

const letters = [
  {
    subject: "trenio.by — проверка почты",
    text: "Это первое тестовое письмо с сайта trenio.by.\nОтправитель: trenioby@gmail.com.\nОтвечать не нужно.",
  },
  {
    subject: "trenio.by — проверка письма с сайта",
    text: "Это второе тестовое письмо с сайта trenio.by.\nТак уходят служебные письма: код, сброс пароля, отзыв.\nКода в этом письме нет.",
  },
];

function encodeSubject(subject) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function sendOne(letter) {
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(letter.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    letter.text,
  ].join("\r\n");

  return new Promise((resolve, reject) => {
    const proc = spawn(sendmail, ["-i", "-f", envelope, to], { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `sendmail exited with code ${code}`));
    });
    proc.stdin.write(raw);
    proc.stdin.end();
  });
}

for (const letter of letters) {
  await sendOne(letter);
  console.log("sent:", letter.subject);
}
