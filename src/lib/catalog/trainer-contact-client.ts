import { recordTrainerContactClickFn } from "@/lib/catalog/trainer-contact-record";

export function recordTrainerContactClick(slug: string, kind: "phone" | "instagram" | "telegram" | "threads" | "message") {
  void recordTrainerContactClickFn({ data: { slug, kind } }).catch(() => {});
}
