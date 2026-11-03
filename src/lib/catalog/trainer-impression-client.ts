import { recordTrainerCardImpressionsFn } from "@/lib/catalog/trainer-impressions";

const seen = new Set<string>();
const queue: string[] = [];
let timer = 0;

function flush() {
  timer = 0;
  const slugs = queue.splice(0, 80);
  if (queue.length > 0) timer = window.setTimeout(flush, 400);
  void recordTrainerCardImpressionsFn({ data: { slugs } }).catch(() => {});
}

/** Remember that this published card was painted in the catalog. Favorites lists do not call this. */
export function noteTrainerCardImpression(slug: string) {
  if (typeof window === "undefined") return;
  if (!/^[a-z0-9._-]{1,30}$/.test(slug)) return;
  if (seen.has(slug)) return;
  seen.add(slug);
  queue.push(slug);
  if (!timer) timer = window.setTimeout(flush, 400);
}
