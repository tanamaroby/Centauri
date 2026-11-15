import { NextResponse, connection } from "next/server";
import { count } from "drizzle-orm";
import { database } from "@/lib/db";
import { pushSubscriptions, tickets } from "@/lib/db/schema";
import { serializeTicket } from "@/lib/db/serialize";
import { jsonError, noStore } from "@/lib/api-helpers";
import { deviceTimeZone, vapidKeys } from "@/lib/push/server";
import { upcomingReminders } from "@/lib/push/reminders";

/** Notification status for the settings screen: public key, device count and the next reminders. */
export async function GET() {
  await connection();
  try {
    const keys = vapidKeys();
    const db = await database();
    const [{ devices }] = await db.select({ devices: count() }).from(pushSubscriptions);
    const all = (await db.select().from(tickets)).map(serializeTicket);
    const upcoming = upcomingReminders(all, await deviceTimeZone()).map((r) => ({
      title: r.title,
      body: r.body,
      url: r.url,
      fireAt: r.fireAt.toISOString(),
    }));
    return NextResponse.json(
      { configured: !!keys, publicKey: keys?.publicKey ?? null, scheduler: !!process.env.CRON_SECRET, devices, upcoming },
      noStore,
    );
  } catch (e) {
    return jsonError(e);
  }
}
