import { addDays, format } from "date-fns";
import type { Ticket, TicketValues } from "@/lib/types";

/**
 * Decides whether a newly read file belongs to a ticket you already have: an extra-baggage
 * receipt for a flight, a hotel's payment confirmation, a seat upgrade bought later, a
 * re-sent itinerary. All on-device heuristics over the parsed fields and raw text.
 */
export type TicketMatch = { ticket: Ticket; score: number; reason: string };

const norm = (s: string | null | undefined) => (s ?? "").replace(/[\s-]+/g, "").toUpperCase();
const day = (v: string | null | undefined) => v?.slice(0, 10) ?? null;

/** Upcoming, in progress, or ended in the last couple of days (a late receipt), or undated. */
export function isActive(t: Pick<Ticket, "departureAt" | "arrivalAt">, now = new Date()) {
  const end = day(t.arrivalAt) ?? day(t.departureAt);
  return !end || end >= format(addDays(now, -2), "yyyy-MM-dd");
}

/** Does the text contain this token as a whole word, allowing spaces or dashes inside it ("TR 606", "K7X-Q2P")? */
function mentions(text: string, token: string | null | undefined, min = 5) {
  const t = norm(token);
  if (t.length < min || !text) return false;
  const body = [...t].map((c) => c.replace(/[^A-Z0-9]/g, "\\$&")).join("[\\s-]?");
  return new RegExp(`(?<![A-Z0-9])${body}(?![A-Z0-9])`, "i").test(text);
}

const words = (s: string | null | undefined) =>
  new Set((s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["hotel", "the", "and", "resort", "stay"].includes(w)));

function overlaps(a: Partial<TicketValues>, b: Ticket) {
  const aStart = day(a.departureAt), aEnd = day(a.arrivalAt) ?? aStart;
  const bStart = day(b.departureAt), bEnd = day(b.arrivalAt) ?? bStart;
  if (!aStart || !bStart || !aEnd || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/** Scores one existing ticket against what was read from the new file. */
export function scoreMatch(t: Ticket, f: Partial<TicketValues>, text: string): TicketMatch | null {
  let score = 0;
  const reasons: string[] = [];
  const add = (n: number, why: string) => {
    score += n;
    reasons.push(why);
  };
  const sameDay = !!f.departureAt && day(f.departureAt) === day(t.departureAt);

  if (norm(f.bookingRef) && norm(f.bookingRef) === norm(t.bookingRef)) add(60, `same booking ref ${t.bookingRef}`);
  else if (mentions(text, t.bookingRef, 5)) add(50, `mentions booking ref ${t.bookingRef}`);
  else if (norm(f.bookingRef) && norm(t.bookingRef)) score -= 30; // two different refs: probably another booking

  if (t.type === "flight" || t.type === "boat" || t.type === "train" || t.type === "bus") {
    const sameNo = norm(f.reference) && norm(f.reference) === norm(t.reference);
    if (sameNo && sameDay) add(50, `same ${t.type === "flight" ? "flight" : "trip"} ${t.reference} on the same day`);
    else if (sameNo) add(20, `same number ${t.reference}`);
    else if (mentions(text, t.reference, 4) && (sameDay || !f.departureAt)) add(30, `mentions ${t.reference}`);
    if (norm(f.origin) && norm(f.destination) && norm(f.origin) === norm(t.origin) && norm(f.destination) === norm(t.destination)) {
      add(sameDay ? 30 : 10, `same route ${t.origin} → ${t.destination}`);
    }
  }

  if (t.type === "stay") {
    const name = words(t.title);
    const shared = [...words(f.title)].filter((w) => name.has(w)).length;
    const named = name.size > 0 && (shared >= Math.min(2, name.size) || [...name].filter((w) => text.toLowerCase().includes(w)).length >= Math.min(2, name.size));
    if (named) add(30, `same hotel`);
    if (overlaps(f, t)) add(f.type === "stay" ? 25 : 10, "same dates");
  } else if (sameDay && f.type && f.type === t.type) {
    add(10, "same day");
  }

  if (norm(f.passengerName) && norm(f.passengerName) === norm(t.passengerName)) add(5, "same passenger");
  return score >= 45 ? { ticket: t, score, reason: reasons.slice(0, 2).join(", ") || "similar details" } : null;
}

/** Active tickets the new file most likely belongs to, best first (at most three). */
export function findRelatedTickets(tickets: Ticket[], fields: Partial<TicketValues>, text = "", now = new Date()) {
  return tickets
    .filter((t) => isActive(t, now))
    .map((t) => scoreMatch(t, fields, text))
    .filter((m): m is TicketMatch => !!m)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
