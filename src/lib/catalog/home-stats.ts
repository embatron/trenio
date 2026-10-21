import { createServerFn } from "@tanstack/react-start";
import { avg, count, eq, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles, trainerReviews } from "@/db/schema";

export type HomeStats = {
  trainers: number;
  sports: number;
  cities: number;
  rating: string | null;
};

export const getHomeStatsFn = createServerFn({ method: "GET" }).handler(async (): Promise<HomeStats> => {
  const db = getDb();
  const profiles = await db
    .select({
      city: trainerProfiles.city,
      sports: trainerProfiles.sports,
    })
    .from(trainerProfiles)
    .where(ne(trainerProfiles.status, "archived"));

  const sports = new Set<string>();
  const cities = new Set<string>();
  for (const profile of profiles) {
    const city = profile.city.trim().toLowerCase();
    if (city) cities.add(city);
    for (const sport of profile.sports) {
      const key = (sport.slug || sport.label).trim().toLowerCase();
      if (key) sports.add(key);
    }
  }

  const [ratingRow] = await db
    .select({
      reviews: count(),
      average: avg(trainerReviews.rating),
    })
    .from(trainerReviews)
    .where(eq(trainerReviews.status, "published"));

  const reviews = Number(ratingRow?.reviews ?? 0);
  const average = Number(ratingRow?.average);
  return {
    trainers: profiles.length,
    sports: sports.size,
    cities: cities.size,
    rating: reviews > 0 && Number.isFinite(average) ? average.toFixed(1) : null,
  };
});
