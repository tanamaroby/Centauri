import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-helpers";
import { removeSubscription, saveSubscription } from "@/lib/push/server";

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2000),
    keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
  }),
  timeZone: z.string().max(100).nullish(),
});

/** Saves (or refreshes) this device's push subscription. */
export async function POST(request: NextRequest) {
  try {
    const { subscription, timeZone } = subscribeSchema.parse(await request.json());
    await saveSubscription({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      timeZone,
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(await request.json());
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
