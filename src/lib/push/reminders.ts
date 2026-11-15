import type { Ticket } from "@/lib/types";
import { needsCheckIn } from "@/lib/tickets";
import { placeTimeZone, zonedToUtc } from "./timezones";

export type Reminder = {
  /** Unique per ticket, event and scheduled instant, so a changed time reminds again. */
  key: string;
  /** Reminders sharing a group belong to one moment (e.g. a departure); only the latest due one is sent. */
  group: string;
  fireAt: Date;
  eventAt: Date;
  title: string;
  body: string;
  url: string;
};

type Rule = { before: number; title: (t: Ticket) => string };
const H = 60 * 60 * 1000;

const DEPART_RULES: Partial<Record<Ticket["type"], Rule[]>> = {
  flight: [
    { before: 24 * H, title: (t) => (needsCheckIn(t) ? "Check in for tomorrow's flight" : "Flight tomorrow") },
    { before: 3 * H, title: () => "Flight in 3 hours, time to head to the airport" },
  ],
  boat: [
    { before: 24 * H, title: () => "Ferry tomorrow" },
    { before: 90 * 60 * 1000, title: () => "Ferry in 90 minutes" },
  ],
  train: [
    { before: 24 * H, title: () => "Train tomorrow" },
    { before: 60 * 60 * 1000, title: () => "Train in 1 hour" },
  ],
  bus: [
    { before: 24 * H, title: () => "Bus tomorrow" },
    { before: 60 * 60 * 1000, title: () => "Bus in 1 hour" },
  ],
  event: [{ before: 2 * H, title: () => "Starting in 2 hours" }],
  other: [{ before: 2 * H, title: () => "Coming up in 2 hours" }],
  stay: [
    { before: 24 * H, title: () => "Hotel check-in tomorrow" },
    { before: 3 * H, title: () => "Hotel check-in today" },
  ],
};
const CHECKOUT_RULES: Rule[] = [{ before: 2 * H, title: () => "Check-out in 2 hours" }];

/** Date-only entries get sensible default times. */
const withTime = (v: string, fallback: string) => (v.includes("T") ? v : `${v}T${fallback}`);
const hhmm = (v: string) => (v.includes("T") ? v.slice(11, 16) : null);

function route(t: Ticket) {
  const a = t.origin || t.originName;
  const b = t.destination || t.destinationName;
  return a && b ? `${a} → ${b}` : a || b || null;
}

function departBody(t: Ticket, local: string) {
  const time = hhmm(local);
  if (t.type === "stay") {
    return [t.title, time && `check-in from ${time}`, t.reference && `room ${t.reference}`].filter(Boolean).join(" · ");
  }
  const head = [t.type === "flight" ? t.reference : null, route(t) ?? t.title].filter(Boolean).join(" ");
  const bits = [
    time && `departs ${time}`,
    t.terminal && `Terminal ${t.terminal}`,
    t.gate && `Gate ${t.gate}`,
    t.seat && `Seat ${t.seat}`,
    t.type === "flight" && t.bookingRef ? `PNR ${t.bookingRef}` : null,
  ].filter(Boolean);
  return [head, ...bits].join(" · ");
}

/** Every reminder a ticket can produce, whether due or not. */
export function ticketReminders(t: Ticket, fallbackTz: string): Reminder[] {
  const out: Reminder[] = [];
  const url = `/tickets/${t.id}`;
  const departTz =
    (t.type === "stay"
      ? placeTimeZone(null, t.destinationName ?? t.originName)
      : placeTimeZone(t.origin, t.originName)) ?? fallbackTz;

  const add = (group: string, local: string, rules: Rule[], body: string, tz: string) => {
    const eventAt = zonedToUtc(local, tz);
    for (const r of rules) {
      const fireAt = new Date(eventAt.getTime() - r.before);
      out.push({
        key: `${t.id}:${group}:${r.before}:${eventAt.toISOString()}`,
        group: `${t.id}:${group}`,
        fireAt,
        eventAt,
        title: r.title(t),
        body,
        url,
      });
    }
  };

  if (t.departureAt) {
    const local = withTime(t.departureAt, t.type === "stay" ? "15:00" : "09:00");
    add("depart", local, DEPART_RULES[t.type] ?? DEPART_RULES.other!, departBody(t, t.departureAt), departTz);
  }
  if (t.type === "stay" && t.arrivalAt) {
    const local = withTime(t.arrivalAt, "11:00");
    const time = hhmm(t.arrivalAt) ?? "11:00";
    add("checkout", local, CHECKOUT_RULES, `${t.title} · check-out by ${time}`, departTz);
  }
  return out;
}

/** Reminders to send now: per group, the latest one whose time has come while the event is still ahead. */
export function dueReminders(tickets: Ticket[], fallbackTz: string, now = new Date()) {
  const byGroup = new Map<string, { send: Reminder; all: Reminder[] }>();
  for (const t of tickets) {
    for (const r of ticketReminders(t, fallbackTz)) {
      if (r.fireAt > now || r.eventAt <= now) continue;
      const g = byGroup.get(r.group);
      if (!g) byGroup.set(r.group, { send: r, all: [r] });
      else {
        g.all.push(r);
        if (r.fireAt > g.send.fireAt) g.send = r;
      }
    }
  }
  return [...byGroup.values()];
}

/** The next few reminders that will go out, soonest first. */
export function upcomingReminders(tickets: Ticket[], fallbackTz: string, now = new Date(), limit = 5) {
  return tickets
    .flatMap((t) => ticketReminders(t, fallbackTz))
    .filter((r) => r.fireAt > now)
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, limit);
}
