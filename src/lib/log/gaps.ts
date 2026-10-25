const LOGGER_IMPORT = /@\/lib\/log\/|lib\/log\/(?:logger|client-reporter)/;

export function fileHasLoggingGap(source: string): boolean {
  if (!/console\.(error|warn)\(/.test(source)) return false;
  return !LOGGER_IMPORT.test(source);
}

export function isLoggingGapPath(filePath: string): boolean {
  const path = filePath.replaceAll("\\", "/");
  if (path.includes("sync-conflict")) return false;
  if (path.endsWith("src/db/seed.ts")) return false;
  if (path.endsWith("src/db/sync-instagram-trainers.ts")) return false;
  if (path.endsWith("src/lib/log/logger.ts")) return false;
  if (path.includes("/scripts/")) return false;
  return path.startsWith("src/") || path.includes("/src/");
}
