import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";

export const getTrainerCertificatesFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().trim().min(1).max(18) }))
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .select({ certificates: trainerProfiles.certificates })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    return row?.certificates ?? [];
  });
