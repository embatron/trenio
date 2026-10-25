import { createServerFn } from "@tanstack/react-start";
import { ne } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";

export type HomeStats = {
  trainers: number;
  sports: number;
  cities: number;
  /** Mean years of experience. Empty profiles (0) are not in the average. */
  experience: number | null;
};

export const getHomeStatsFn = createServerFn({ method: "GET" }).handler(async (): Promise<HomeStats> => {
  const db = getDb();
  const profiles = await db
    .select({
      city: trainerProfiles.city,
      sports: trainerProfiles.sports,
      experienceYears: trainerProfiles.experienceYears,
    })
    .from(trainerProfiles)
    .where(ne(trainerProfiles.status, "archived"));

  const sports = new Set<string>();
  const cities = new Set<string>();
  const years: number[] = [];
  for (const profile of profiles) {
    const city = profile.city.trim().toLowerCase();
    if (city) cities.add(city);
    for (const sport of profile.sports) {
      const key = (sport.slug || sport.label).trim().toLowerCase();
      if (key) sports.add(key);
    }
    if (profile.experienceYears >= 1) years.push(profile.experienceYears);
  }

  const experience = years.length
    ? Math.round(years.reduce((sum, year) => sum + year, 0) / years.length)
    : null;

  return {
    trainers: profiles.length,
    sports: sports.size,
    cities: cities.size,
    experience,
  };
});
