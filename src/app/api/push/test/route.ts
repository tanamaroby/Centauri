import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { jsonError } from "@/lib/api-helpers";
import { sendToAll } from "@/lib/push/server";

/** Sends a test notification to this device. */
export async function POST(request: NextRequest) {
  try {
    const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(await request.json());
    const db = await database();
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    if (!subs.length) return NextResponse.json({ error: "This device is not subscribed" }, { status: 404 });
    const res = await sendToAll(
      { title: "Centauri", body: "Notifications are on. You'll get reminders before flights, ferries and hotel check-ins.", url: "/settings", tag: "test" },
      subs,
    );
    if (!res.sent) return NextResponse.json({ error: "The push service rejected the notification" }, { status: 502 });
    return NextResponse.json(res);
  } catch (e) {
    return jsonError(e);
  }
}
