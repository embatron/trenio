import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** One Nominatim result per normalized query. Null coordinates mean "not found". */
export const geocodeCache = pgTable("geocode_cache", {
  queryNorm: text("query_norm").primaryKey(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  displayName: text("display_name"),
  city: text("city"),
  district: text("district"),
  street: text("street"),
  /** `by` for a Belarus hit. Any other code means the query is outside Belarus. Null coords and null code mean not found. */
  countryCode: text("country_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GeocodeCacheRow = typeof geocodeCache.$inferSelect;
