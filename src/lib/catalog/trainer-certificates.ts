import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import { readCertificates } from "@/lib/catalog/certificate-file";

export const getTrainerCertificatesFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().trim().min(1).max(30) }))
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .select({
        certificates: trainerProfiles.certificates,
        photos: trainerProfiles.photos,
        avatarPath: trainerProfiles.avatarPath,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    const stored = row?.photos ?? [];
    const photos = (stored.length > 0 ? stored : row?.avatarPath ? [row.avatarPath] : []).slice(0, 9);
    return { certificates: readCertificates(row?.certificates), photos };
  });
