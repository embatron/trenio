import { eq } from "drizzle-orm";

import { closeDb, getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import { mirrorTrainingPlace, resolveTrainingPlaces } from "@/lib/geo/resolve";
import { placesFromProfile } from "@/lib/geo/schemas";

const db = getDb();
const rows = await db.select().from(trainerProfiles);
let updated = 0;
for (const row of rows) {
  const stored = placesFromProfile(row);
  const open = stored.some((place) => place.address.trim() && place.geocodeStatus !== "ok");
  if (!open) continue;
  const resolved = await resolveTrainingPlaces(stored, stored);
  const mirror = mirrorTrainingPlace(resolved);
  await db.update(trainerProfiles).set({
    trainingPlaces: resolved,
    address: mirror.address,
    addressLat: mirror.addressLat,
    addressLng: mirror.addressLng,
    geocodeStatus: mirror.geocodeStatus,
    updatedAt: new Date(),
  }).where(eq(trainerProfiles.id, row.id));
  updated += 1;
  console.info(JSON.stringify({
    slug: row.slug,
    places: resolved.map((place) => ({
      status: place.geocodeStatus,
      city: place.city,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    })),
  }));
}
console.info(JSON.stringify({ updated }));
await closeDb();
