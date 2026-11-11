import { recordTrainerContactClickFn } from "@/lib/catalog/trainer-contact-record";

export function recordTrainerContactClick(slug: string, kind: "phone" | "instagram" | "telegram" | "message") {
  void recordTrainerContactClickFn({ data: { slug, kind } }).catch(() => {});
}
