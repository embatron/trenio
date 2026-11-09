import type { TrainerCertificate } from "@/lib/catalog/certificate-file";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export type CertificateKind = "image" | "pdf" | "file";

/** A public document: the original file plus the small copies used on the profile. */
export type TrainerDocument = TrainerCertificate & {
  kind: CertificateKind;
  ext: string;
  thumb: string;
  view: string;
};

export function certificateExt(storedPath: string) {
  const ext = storedPath.split("?")[0].match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() ?? "";
  return ext === "jpeg" ? "jpg" : ext;
}

export function certificateKind(storedPath: string): CertificateKind {
  const ext = certificateExt(storedPath);
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "file";
}

/** JPEG copies beside the original: `diploma.pdf` → `diploma-doc-thumb.jpg`. */
export function certificatePreviewPaths(storedPath: string) {
  const clean = storedPath.split("?")[0];
  const base = clean.replace(/\.[a-z0-9]+$/i, "");
  return { thumb: `${base}-doc-thumb.jpg`, view: `${base}-doc-view.jpg` };
}

/** Only files already published under `/trainers/`. */
export function trainerMediaPath(storedPath: string) {
  const clean = storedPath.split("?")[0];
  if (!clean.startsWith("/trainers/") || clean.includes("..") || clean.includes("\\")) return null;
  return clean;
}
