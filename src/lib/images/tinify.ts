import tinify from "tinify";

/**
 * TinyPNG / TinyJPG. JPEG, PNG, WebP, and AVIF only.
 * An empty `TINIFY_API_KEY` keeps the original bytes so uploads still succeed.
 */

let appliedKey = "";

export function tinifyKey(): string {
  return process.env.TINIFY_API_KEY?.trim() ?? "";
}

function applyKey(key: string) {
  if (appliedKey === key) return;
  tinify.key = key;
  appliedKey = key;
}

export function isCompressibleImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return true;
  const ftyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  if (!ftyp) return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return brand === "avif" || brand === "avis";
}

/** Trainer photos live under this path segment and stay out of the backlog pass. */
export function shouldTinifyStoredFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return false;
  if (normalized.split("/").includes("trainers")) return false;
  return /\.(png|jpe?g|webp|avif)$/i.test(normalized);
}

export function tinifyErrorKind(error: unknown): "account" | "client" | "other" {
  if (error instanceof tinify.AccountError) return "account";
  if (error instanceof tinify.ClientError) return "client";
  return "other";
}

export function tinifyCompressionCount(): number | null {
  return typeof tinify.compressionCount === "number" ? tinify.compressionCount : null;
}

async function compressOnce(input: Buffer): Promise<Buffer> {
  const result = await tinify.fromBuffer(input).toBuffer();
  const output = Buffer.from(result);
  return output.length > 0 && output.length < input.length ? output : input;
}

/** Returns the same buffer when the key is missing, the file is not a photo, or TinyPNG is not smaller. */
export async function tinifyImage(input: Buffer): Promise<Buffer> {
  const key = tinifyKey();
  if (!key || !isCompressibleImage(input)) return input;
  applyKey(key);
  try {
    return await compressOnce(input);
  } catch (error) {
    const retry = error instanceof tinify.ServerError || error instanceof tinify.ConnectionError;
    if (!retry) throw error;
    return compressOnce(input);
  }
}

/** Upload path: keep the original when TinyPNG fails, and write the failure to the journal. */
export async function shrinkImage(input: Buffer): Promise<Buffer> {
  try {
    return await tinifyImage(input);
  } catch (error) {
    const { logCaught } = await import("@/lib/log/logger");
    logCaught("system", "system.image", error);
    return input;
  }
}
