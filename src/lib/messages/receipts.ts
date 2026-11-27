export type MessageReceipt = "sent" | "delivered" | "read";

/** Read wins, then delivery to the other client, otherwise the server has it. */
export function messageReceipt(id: number, readUpTo: number | null, deliveredUpTo: number | null): MessageReceipt {
  if (readUpTo != null && id <= readUpTo) return "read";
  if (deliveredUpTo != null && id <= deliveredUpTo) return "delivered";
  return "sent";
}
