import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import type { MailKind } from "@/lib/mail/kinds";

/** True when this address still wants that kind of letter. Unknown addresses stay off marketing only. */
export async function recipientAllowsMail(email: string, kind: MailKind): Promise<boolean> {
  if (kind === "site") return true;
  const [row] = await getDb()
    .select({
      messages: users.mailMessages,
      reviews: users.mailReviews,
      marketing: users.mailMarketing,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!row) return kind !== "marketing";
  return row[kind];
}
