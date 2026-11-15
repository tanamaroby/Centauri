import "server-only";
import webpush from "web-push";
import { desc, eq, inArray, lt } from "drizzle-orm";
import { database } from "@/lib/db";
import { pushLog, pushSubscriptions, tickets } from "@/lib/db/schema";
import { serializeTicket } from "@/lib/db/serialize";
import { isValidTimeZone } from "./timezones";
import { dueReminders } from "./reminders";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export function vapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // Apple requires a mailto: or https: subject.
  const subject = process.env.VAPID_SUBJECT?.trim() || "https://centauri-tanamarobys-projects.vercel.app";
  return { publicKey, privateKey, subject };
}

let configured = false;
function setup() {
  const keys = vapidKeys();
  if (!keys) throw new Error("Notifications are not set up: add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel.");
  if (!configured) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    configured = true;
  }
}

type Sub = typeof pushSubscriptions.$inferSelect;

/** Sends one payload to the given devices. Devices the push service says are gone are removed. */
export async function sendToAll(payload: PushPayload, subs?: Sub[]) {
  setup();
  const db = await database();
  const list = subs ?? (await db.select().from(pushSubscriptions));
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
        else console.error("[push] send failed", status, (e as Error).message);
      }
    }),
  );
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, gone));
  return { sent, removed: gone.length, devices: list.length };
}

/** Time zone of the most recently active device, for tickets whose place has no known zone. */
export async function deviceTimeZone() {
  const db = await database();
  const [latest] = await db.select().from(pushSubscriptions).orderBy(desc(pushSubscriptions.updatedAt)).limit(1);
  return isValidTimeZone(latest?.timeZone) ? latest.timeZone : "UTC";
}

/** Called by the scheduler: sends every reminder that has come due since the last run. */
export async function runReminders(now = new Date()) {
  setup();
  const db = await database();
  const subs = await db.select().from(pushSubscriptions);
  if (!subs.length) return { due: 0, sent: 0, devices: 0 };

  const tz = await deviceTimeZone();
  const all = (await db.select().from(tickets)).map(serializeTicket);
  const groups = dueReminders(all, tz, now);
  if (!groups.length) return { due: 0, sent: 0, devices: subs.length };

  const keys = groups.flatMap((g) => g.all.map((r) => r.key));
  const done = new Set(
    (await db.select({ key: pushLog.key }).from(pushLog).where(inArray(pushLog.key, keys))).map((r) => r.key),
  );

  let sent = 0;
  for (const g of groups) {
    const fresh = g.all.filter((r) => !done.has(r.key));
    if (!fresh.length) continue;
    // Record first so an overlapping run cannot send the same reminder again.
    const claimed = await db
      .insert(pushLog)
      .values(fresh.map((r) => ({ key: r.key })))
      .onConflictDoNothing()
      .returning({ key: pushLog.key });
    if (!claimed.some((c) => c.key === g.send.key)) continue;
    const r = g.send;
    const res = await sendToAll({ title: r.title, body: r.body, url: r.url, tag: r.group }, subs);
    sent += res.sent;
  }

  // Keep the log small.
  await db.delete(pushLog).where(lt(pushLog.sentAt, new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)));
  return { due: groups.length, sent, devices: subs.length };
}

export async function saveSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  timeZone?: string | null;
  userAgent?: string | null;
}) {
  const db = await database();
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : null;
  await db
    .insert(pushSubscriptions)
    .values({ ...input, timeZone })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: input.p256dh, auth: input.auth, timeZone, userAgent: input.userAgent, updatedAt: new Date() },
    });
}

export async function removeSubscription(endpoint: string) {
  const db = await database();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
