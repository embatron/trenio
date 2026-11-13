import { and, eq, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { userDevices } from "@/db/schema";
import type { DeviceRegister } from "@/lib/mobile/device-body";

export async function saveDevice(userId: string, device: DeviceRegister): Promise<void> {
  const db = getDb();
  await db.delete(userDevices).where(and(eq(userDevices.pushToken, device.token), ne(userDevices.userId, userId)));
  if (device.replacedToken && device.replacedToken !== device.token) {
    await db.delete(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.pushToken, device.replacedToken)));
  }
  const now = new Date();
  await db
    .insert(userDevices)
    .values({
      userId,
      platform: device.platform,
      pushToken: device.token,
      tokenType: device.tokenType,
      deviceName: device.deviceName,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userDevices.userId, userDevices.pushToken],
      set: {
        platform: device.platform,
        tokenType: device.tokenType,
        deviceName: device.deviceName,
        updatedAt: now,
      },
    });
}

export async function removeDevice(userId: string, token: string): Promise<void> {
  await getDb().delete(userDevices).where(and(eq(userDevices.userId, userId), eq(userDevices.pushToken, token)));
}

export async function listDevices(userId: string) {
  const rows = await getDb()
    .select({
      platform: userDevices.platform,
      tokenType: userDevices.tokenType,
      deviceName: userDevices.deviceName,
      pushToken: userDevices.pushToken,
      updatedAt: userDevices.updatedAt,
    })
    .from(userDevices)
    .where(eq(userDevices.userId, userId));
  return rows.map((row) => ({
    platform: row.platform,
    tokenType: row.tokenType,
    deviceName: row.deviceName,
    updatedAt: row.updatedAt.toISOString(),
    tokenTail: row.pushToken.slice(-4),
  }));
}

export async function listApnsTokens(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ pushToken: userDevices.pushToken })
    .from(userDevices)
    .where(and(eq(userDevices.userId, userId), eq(userDevices.tokenType, "apns")));
  return rows.map((row) => row.pushToken);
}
