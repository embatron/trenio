import { z } from "zod";

import { isUnsafeClientMessage } from "@/lib/log/redact";

export const CLIENT_LOG_DOMAINS = ["ajax", "client", "form", "map", "geo"] as const;

export const clientLogEventSchema = z.object({
  domain: z.enum(CLIENT_LOG_DOMAINS),
  level: z.enum(["warn", "error"]),
  action: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9._-]+$/),
  message: z.string().trim().min(1).max(500),
  route: z.string().trim().max(300).optional(),
  statusCode: z.number().int().min(0).max(599).optional(),
  durationMs: z.number().int().min(0).max(120_000).optional(),
  requestId: z.string().uuid().optional(),
});

export const clientLogBatchSchema = z.object({
  events: z.array(clientLogEventSchema).min(1).max(8),
});

export type ClientLogEvent = z.infer<typeof clientLogEventSchema>;

export function acceptClientEvent(event: ClientLogEvent): boolean {
  return !isUnsafeClientMessage(event.message) && !isUnsafeClientMessage(event.route ?? "");
}
