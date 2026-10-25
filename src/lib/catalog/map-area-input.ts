import { z } from "zod";

export const areaSchema = z.object({
  south: z.number().finite().min(-90).max(90),
  west: z.number().finite().min(-540).max(540),
  north: z.number().finite().min(-90).max(90),
  east: z.number().finite().min(-540).max(540),
  zoom: z.number().finite().min(0).max(20),
  sports: z.array(z.string().trim().min(1).max(40)).max(24).optional(),
  city: z.string().trim().max(120).optional(),
  audience: z.enum(["self", "child"]).nullable().optional(),
  formats: z.array(z.enum(["individual", "group"])).max(2).optional(),
  minExperience: z.number().int().min(0).max(80).nullable().optional(),
  priceMin: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  priceMax: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  cursor: z.number().int().min(0).max(100_000).optional(),
  includeFeatures: z.boolean().optional(),
});

export type MapAreaInput = z.infer<typeof areaSchema>;
