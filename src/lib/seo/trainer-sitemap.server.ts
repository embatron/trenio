import { eq } from "drizzle-orm";

import { catalogPathsForSitemap, indexableCitySportPaths, type CitySportPresence } from "@/lib/catalog/catalog-sports";
import { cityCatalogSlug } from "@/lib/catalog/city-pages";
import { MAX_TRAINER_SPORTS, trainerSportDatives } from "@/lib/catalog/sport-taxonomy";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { cardFace } from "@/lib/catalog/account-face";
import { publicTrainerCityLabel } from "@/lib/catalog/trainer-city";
import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema/trainer-profiles";
import { logCaught } from "@/lib/log/logger";
import { trainerDocumentPhrase, trainerShareImagePath } from "@/lib/seo/trainer";
import { publicAssetUrl, sitemapDay, trainerSitemapPath, type SitemapTrainer } from "@/lib/seo/sitemap";

function citySportPresence(row: {
  city: string;
  createdSource: string;
  address: string | null;
  trainingPlaces: Array<{ city?: string; address?: string; district?: string }> | null;
  sports: Array<{ slug?: string; parentSlug?: string }> | null;
  primarySport: { slug?: string; parentSlug?: string } | null;
}): CitySportPresence {
  const listed = (row.sports ?? []).flatMap((sport) => {
    const slug = sport?.slug?.trim() ?? "";
    if (!slug) return [];
    return [{ slug, parentSlug: sport.parentSlug?.trim() || slug }];
  });
  const primarySlug = row.primarySport?.slug?.trim() ?? "";
  const sports = (listed.length
    ? listed
    : primarySlug
      ? [{ slug: primarySlug, parentSlug: row.primarySport?.parentSlug?.trim() || primarySlug }]
      : []
  ).slice(0, MAX_TRAINER_SPORTS);
  return {
    city: publicTrainerCityLabel(row),
    sportSlugs: sports.map((sport) => sport.slug),
    sportParents: sports.map((sport) => sport.parentSlug),
  };
}

/** Catalog paths for the sitemap. A city + sport URL is included only while a published trainer matches it. */
export async function listIndexableCatalogPaths(): Promise<string[]> {
  try {
    const rows = await getDb()
      .select({
        city: trainerProfiles.city,
        createdSource: trainerProfiles.createdSource,
        address: trainerProfiles.address,
        trainingPlaces: trainerProfiles.trainingPlaces,
        sports: trainerProfiles.sports,
        primarySport: trainerProfiles.primarySport,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.status, "published"));
    return catalogPathsForSitemap(indexableCitySportPaths(rows.map(citySportPresence)));
  } catch (error) {
    logCaught("catalog", "catalog.sitemap", error);
    return catalogPathsForSitemap([]);
  }
}

/** Published `/trainers/{slug}` rows. A database failure leaves the rest of the sitemap intact. */
export async function listPublishedTrainerSitemapEntries(): Promise<SitemapTrainer[]> {
  try {
    const rows = await getDb()
      .select({
        slug: trainerProfiles.slug,
        updatedAt: trainerProfiles.updatedAt,
        avatarPath: trainerProfiles.avatarPath,
        photos: trainerProfiles.photos,
        firstName: trainerProfiles.firstName,
        lastName: trainerProfiles.lastName,
        fullName: trainerProfiles.fullName,
        city: trainerProfiles.city,
        citySlug: trainerProfiles.citySlug,
        createdSource: trainerProfiles.createdSource,
        address: trainerProfiles.address,
        trainingPlaces: trainerProfiles.trainingPlaces,
        sports: trainerProfiles.sports,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.status, "published"));

    const entries: SitemapTrainer[] = [];
    for (const row of rows) {
      const path = trainerSitemapPath(row.slug);
      if (!path) continue;
      const label = publicTrainerCityLabel(row);
      const sports = (row.sports ?? []).flatMap((sport) => {
        const slug = sport?.slug?.trim() ?? "";
        const name = sport?.label?.trim() ?? "";
        return slug && name ? [{ slug, label: name }] : [];
      });
      const name = joinTrainerName(row.firstName, row.lastName) || row.fullName || row.slug;
      const phrase = trainerDocumentPhrase(trainerSportDatives(sports), {
        slug: cityCatalogSlug(label) || row.citySlug || "",
        label,
      }, name);
      const image = cardFace(row.avatarPath, row.photos)
        ? publicAssetUrl(trainerShareImagePath(row.slug, row.updatedAt.toISOString()))
        : null;
      const lastmod = sitemapDay(row.updatedAt);
      entries.push({
        path,
        ...(lastmod ? { lastmod } : {}),
        ...(image ? { image, imageTitle: phrase } : {}),
      });
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    return entries;
  } catch (error) {
    logCaught("catalog", "catalog.sitemap", error);
    return [];
  }
}
