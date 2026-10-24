import { createServerFn } from "@tanstack/react-start";
import { and, avg, count, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import type { TrainerAudience, TrainerFormat } from "@/lib/catalog/published-trainers";
import { trainerNameParts } from "@/lib/catalog/trainer-name";
import { placesFromProfile } from "@/lib/geo/schemas";

export type MapTrainerPlace = {
  city: string;
  address: string;
  lat: number;
  lng: number;
};

export type MapTrainer = {
  slug: string;
  firstName: string;
  lastName: string;
  name: string;
  photo: string;
  city: string;
  price: number;
  experience: number;
  audiences: TrainerAudience[];
  formats: TrainerFormat[];
  sportSlugs: string[];
  sportParents: string[];
  tags: string[];
  rating: string;
  reviews: number;
  places: MapTrainerPlace[];
};

function isAudience(value: unknown): value is TrainerAudience {
  return value === "adult" || value === "kid" || value === "teen";
}

function isFormat(value: unknown): value is TrainerFormat {
  return value === "individual" || value === "group";
}

/** Published trainers that have at least one confirmed training place. */
export const listMapTrainersFn = createServerFn({ method: "GET" }).handler(async (): Promise<MapTrainer[]> => {
  const db = getDb();
  const rows = await db
    .select({
      slug: trainerProfiles.slug,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      fullName: trainerProfiles.fullName,
      city: trainerProfiles.city,
      avatarPath: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
      sports: trainerProfiles.sports,
      audiences: trainerProfiles.audiences,
      formats: trainerProfiles.formats,
      priceFrom: trainerProfiles.priceFrom,
      experienceYears: trainerProfiles.experienceYears,
      trainingPlaces: trainerProfiles.trainingPlaces,
      address: trainerProfiles.address,
      addressLat: trainerProfiles.addressLat,
      addressLng: trainerProfiles.addressLng,
      geocodeStatus: trainerProfiles.geocodeStatus,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.status, "published"));

  const trainers: MapTrainer[] = [];
  for (const row of rows) {
    const places = placesFromProfile(row).flatMap((place) => {
      if (place.geocodeStatus !== "ok" || place.lat == null || place.lng == null) return [];
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return [];
      return [{ city: place.city, address: place.address, lat: place.lat, lng: place.lng }];
    });
    if (places.length === 0) continue;
    const sports = (row.sports ?? []).flatMap((sport) => {
      const slug = sport?.slug?.trim() ?? "";
      if (!slug) return [];
      return [{
        slug,
        parentSlug: sport.parentSlug?.trim() || slug,
        label: sport.label?.trim() || slug,
      }];
    }).slice(0, 4);
    const name = trainerNameParts(row.firstName, row.lastName, row.fullName);
    trainers.push({
      slug: row.slug,
      firstName: name.firstName,
      lastName: name.lastName,
      name: name.fullName || "Тренер",
      photo: (row.photos?.[0] || row.avatarPath || "").split("?")[0],
      city: row.city.trim(),
      price: row.priceFrom ?? 0,
      experience: row.experienceYears ?? 0,
      audiences: (row.audiences ?? []).filter(isAudience),
      formats: (row.formats ?? []).filter(isFormat),
      sportSlugs: sports.map((sport) => sport.slug),
      sportParents: sports.map((sport) => sport.parentSlug),
      tags: sports.map((sport) => sport.label),
      rating: "0",
      reviews: 0,
      places,
    });
  }

  if (trainers.length > 0) {
    const ratings = await db
      .select({
        slug: trainerReviews.trainerSlug,
        reviews: count(),
        average: avg(trainerReviews.rating),
      })
      .from(trainerReviews)
      .where(and(
        eq(trainerReviews.status, "published"),
        inArray(trainerReviews.trainerSlug, trainers.map((trainer) => trainer.slug)),
      ))
      .groupBy(trainerReviews.trainerSlug);
    const bySlug = new Map(ratings.map((row) => [row.slug, row]));
    for (const trainer of trainers) {
      const row = bySlug.get(trainer.slug);
      const reviews = Number(row?.reviews ?? 0);
      const average = Number(row?.average);
      if (reviews > 0 && Number.isFinite(average)) {
        trainer.rating = average.toFixed(1);
        trainer.reviews = reviews;
      }
    }
  }

  trainers.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return trainers;
});
