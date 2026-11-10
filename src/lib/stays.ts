import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Ticket } from "@/lib/types";

type StayLike = { departureAt?: string | null; arrivalAt?: string | null };

export const isStay = (t: Pick<Ticket, "type">) => t.type === "stay";

/** Number of nights between check-in and check-out (by calendar day). */
export function nights(t: StayLike) {
  if (!t.departureAt || !t.arrivalAt) return null;
  const n = differenceInCalendarDays(parseISO(t.arrivalAt.slice(0, 10)), parseISO(t.departureAt.slice(0, 10)));
  return n > 0 ? n : null;
}

export const nightsLabel = (n: number | null) => (n ? `${n} ${n === 1 ? "night" : "nights"}` : null);

/** "YYYY-MM-DD" of every night spent (check-in day up to the day before check-out). */
export function stayNights(t: StayLike): string[] {
  const n = nights(t);
  if (!n || !t.departureAt) return [];
  const start = parseISO(t.departureAt.slice(0, 10));
  return Array.from({ length: n }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

/** Where we are in a stay right now. */
export function stayStatus(t: StayLike, now = new Date()) {
  if (!t.departureAt) return null;
  const today = format(now, "yyyy-MM-dd");
  const inDay = t.departureAt.slice(0, 10);
  const outDay = t.arrivalAt?.slice(0, 10);
  if (today < inDay) return null;
  if (today === inDay) return { label: "Check-in today", active: true };
  if (outDay && today === outDay) return { label: "Check-out today", active: true };
  if (outDay && today < outDay) {
    const night = differenceInCalendarDays(now, parseISO(inDay)) + 1;
    return { label: `Staying now · night ${night} of ${nights(t)}`, active: true };
  }
  return null;
}

/** Apple Maps link (opens Google Maps or the browser elsewhere). */
export function mapsHref(t: Pick<Ticket, "carrier" | "title" | "address" | "destinationName">) {
  const q = [t.title || t.carrier, t.address || t.destinationName].filter(Boolean).join(", ");
  return q ? `https://maps.apple.com/?q=${encodeURIComponent(q)}` : null;
}

export const telHref = (phone: string | null | undefined) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null);

/** Check-in / check-out label for one end of a stay: "Fri, 12 Dec" plus "from 15:00" when known. */
export function stayDay(v: string | null | undefined) {
  if (!v) return { day: "—", weekday: null, time: null };
  const d = parseISO(v);
  return { day: format(d, "d MMM"), weekday: format(d, "EEE"), time: v.includes("T") ? format(d, "HH:mm") : null };
}
