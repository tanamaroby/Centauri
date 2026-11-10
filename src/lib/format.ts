import { format, isToday, isTomorrow, parseISO, differenceInCalendarDays, differenceInMinutes } from "date-fns";
import type { Ticket, TicketType } from "@/lib/types";

/** Ticket times are local wall-clock strings; parse them as local time. */
export const toDate = (v: string | null | undefined) => (v ? parseISO(v) : null);
export const hasTime = (v: string | null | undefined) => !!v && v.includes("T");

export function fmtTime(v: string | null | undefined) {
  const d = toDate(v);
  return d && hasTime(v) ? format(d, "HH:mm") : null;
}

export function fmtDay(v: string | null | undefined, style: "short" | "long" = "short") {
  const d = toDate(v);
  if (!d) return null;
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, style === "long" ? "EEEE, d MMMM yyyy" : "EEE, d MMM");
}

export function relative(v: string | null | undefined) {
  const d = toDate(v);
  if (!d) return null;
  const now = new Date();
  const days = differenceInCalendarDays(d, now);
  if (days === 0 && hasTime(v)) {
    const mins = differenceInMinutes(d, now);
    if (mins < 0) return "Departed";
    if (mins < 60) return `in ${mins} min`;
    return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `in ${days} days`;
  return `${-days} days ago`;
}

export function duration(a: string | null | undefined, b: string | null | undefined) {
  const x = toDate(a), y = toDate(b);
  if (!x || !y || !hasTime(a) || !hasTime(b)) return null;
  const m = differenceInMinutes(y, x);
  if (m <= 0) return null;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** A ticket counts as upcoming until the end of its arrival (or departure) day. */
export function isUpcoming(t: Ticket, now = new Date()) {
  const ref = t.arrivalAt ?? t.departureAt;
  if (!ref) return true;
  const d = toDate(ref)!;
  if (!hasTime(ref)) d.setHours(23, 59, 59);
  else d.setHours(d.getHours() + 3);
  return d >= now;
}

export const dayKey = (v: string | null | undefined) => (v ? v.slice(0, 10) : "undated");

export const TYPE_LABEL: Record<TicketType, string> = {
  flight: "Flight", boat: "Boat", train: "Train", bus: "Bus", stay: "Stay", event: "Event", other: "Ticket",
};

export const TYPE_GRADIENT: Record<TicketType, string> = {
  flight: "from-indigo-500 via-violet-600 to-indigo-900",
  boat: "from-cyan-500 via-sky-600 to-blue-900",
  train: "from-emerald-500 via-teal-600 to-emerald-900",
  bus: "from-orange-400 via-amber-600 to-orange-900",
  stay: "from-rose-400 via-pink-600 to-rose-900",
  event: "from-fuchsia-500 via-purple-600 to-fuchsia-900",
  other: "from-slate-500 via-slate-600 to-slate-900",
};

export const COLOR_GRADIENTS: Record<string, string> = {
  indigo: TYPE_GRADIENT.flight,
  ocean: TYPE_GRADIENT.boat,
  emerald: TYPE_GRADIENT.train,
  amber: TYPE_GRADIENT.bus,
  rose: TYPE_GRADIENT.stay,
  violet: TYPE_GRADIENT.event,
  slate: TYPE_GRADIENT.other,
  gold: "from-amber-300 via-yellow-500 to-amber-800",
};

export const gradientFor = (t: Pick<Ticket, "type" | "color">) =>
  (t.color && COLOR_GRADIENTS[t.color]) || TYPE_GRADIENT[t.type] || TYPE_GRADIENT.other;

export function tripRange(start: string | null, end: string | null) {
  const f = (d: string) => format(parseISO(d), "d MMM yyyy");
  if (start && end) return `${f(start)} – ${f(end)}`;
  if (start) return `From ${f(start)}`;
  return "No dates yet";
}
