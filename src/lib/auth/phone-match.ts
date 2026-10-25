import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** Match a stored Belarus phone whether the column still holds digits or `+375 29 123-45-67`. */
export function belarusPhoneEquals(column: PgColumn, digits: string): SQL {
  return sql`regexp_replace(${column}, '\\D', '', 'g') = ${digits}`;
}
