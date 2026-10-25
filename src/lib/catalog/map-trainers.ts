import { createServerFn } from "@tanstack/react-start";

import { areaSchema } from "@/lib/catalog/map-area-input";
import { logCaught } from "@/lib/log/logger";

export type {
  MapArea,
  MapAreaFeature,
  MapAreaTrainer,
  MapTrainer,
  MapTrainerPlace,
} from "@/lib/catalog/map-area";

/** One frame of the public map: clusters or pins, plus one page of the nearest trainers. */
export const listMapAreaFn = createServerFn({ method: "GET" })
  .validator(areaSchema)
  .handler(async ({ data }) => {
    try {
      const { loadMapArea } = await import("@/lib/catalog/map-area");
      return await loadMapArea(data);
    } catch (error) {
      logCaught("map", "map.area", error);
      throw error;
    }
  });
