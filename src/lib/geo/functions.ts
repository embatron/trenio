import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { consumeRateLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/auth/rate-limit";
import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import { assertStaff } from "@/lib/admin/access";
import { AuthError } from "@/lib/auth/errors";
import { editorHtml } from "@/lib/catalog/review-html";
import { mirrorTrainingPlace, resolveTrainingPlaces, suggestCachedOrRemote } from "@/lib/geo/resolve";
import {
  placesFromProfile,
  placeLine,
  suggestAddressSchema,
  type AddressSuggestion,
  type TrainerPlace,
} from "@/lib/geo/schemas";

function toSuggestions(hits: AddressSuggestion[]): AddressSuggestion[] {
  return hits.filter((hit) => hit.displayName && hit.lat != null && hit.lng != null).slice(0, 5);
}

export const suggestAddress = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(suggestAddressSchema)
  .handler(async ({ data, context }): Promise<{ suggestions: AddressSuggestion[] }> => {
    const limit = consumeRateLimit(
      `geo:suggest:${context.user.id}`,
      RATE_LIMITS.geocodeUser.windowMs,
      RATE_LIMITS.geocodeUser.max,
    );
    if (!limit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
    const hits = await suggestCachedOrRemote(data.query, () => true);
    if (hits === "limited") return { suggestions: [] };
    return {
      suggestions: toSuggestions(hits.map((hit) => ({
        displayName: hit.displayName,
        city: hit.city,
        district: hit.district,
        street: hit.street,
        lat: hit.lat,
        lng: hit.lng,
      }))),
    };
  });

export const getTrainerAddressFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().trim().min(1).max(30) }))
  .handler(async ({ data }): Promise<{ places: Array<{ city: string; district: string; address: string; lat: number | null; lng: number | null }>; about: string }> => {
    const [row] = await getDb()
      .select({
        trainingPlaces: trainerProfiles.trainingPlaces,
        address: trainerProfiles.address,
        addressLat: trainerProfiles.addressLat,
        addressLng: trainerProfiles.addressLng,
        geocodeStatus: trainerProfiles.geocodeStatus,
        about: trainerProfiles.about,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    const places = placesFromProfile(row ?? {}).map((place) => {
      const mapped = place.geocodeStatus === "ok" && place.lat != null && place.lng != null;
      return {
        city: place.city,
        district: place.district,
        address: place.address,
        lat: mapped ? place.lat : null,
        lng: mapped ? place.lng : null,
      };
    }).filter((place) => placeLine(place));
    return { places, about: editorHtml(row?.about ?? []) };
  });

export const adminGeocodeTrainer = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<{ places: TrainerPlace[]; message: string }> => {
    assertStaff(context.user.roles);
    const limit = consumeRateLimit(
      `geo:admin:${context.user.id}`,
      RATE_LIMITS.geocodeUser.windowMs,
      RATE_LIMITS.geocodeUser.max,
    );
    if (!limit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");

    const db = getDb();
    const [existing] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.id, data.id)).limit(1);
    if (!existing) throw new AuthError("Профиль тренера не найден.", "VALIDATION");
    const stored = placesFromProfile(existing);
    if (stored.length === 0) throw new AuthError("Сначала сохраните адрес текстом.", "VALIDATION");

    const resolved = await resolveTrainingPlaces(stored, stored, { force: true });
    const places = resolved.map((place) => {
      const previous = stored.find((item) => item.city === place.city && item.district === place.district && item.address === place.address);
      if (place.geocodeStatus === "pending" && previous?.geocodeStatus === "ok" && previous.lat != null && previous.lng != null) {
        return previous;
      }
      return place;
    });
    const mirror = mirrorTrainingPlace(places);
    await db.update(trainerProfiles).set({
      trainingPlaces: places,
      address: mirror.address,
      addressLat: mirror.addressLat,
      addressLng: mirror.addressLng,
      geocodeStatus: mirror.geocodeStatus,
      updatedAt: new Date(),
    }).where(eq(trainerProfiles.id, existing.id));

    const pending = places.some((place) => place.geocodeStatus === "pending");
    const missing = places.some((place) => place.geocodeStatus === "not_found");
    const message = pending
      ? "Сервис геокодирования недоступен. Уже найденные координаты сохранены."
      : missing
        ? "Часть адресов не найдена. На карточке останется текст."
        : "Координаты обновлены.";
    return { places, message };
  });
