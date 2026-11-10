"use client";

import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { BedDouble, Plus } from "lucide-react";
import type { Ticket, TicketType, Trip } from "@/lib/types";
import { gradientFor, TYPE_LABEL } from "@/lib/format";
import { isStay, nights, nightsLabel, stayNights } from "@/lib/stays";
import { TypeIcon } from "@/components/ticket-icon";
import { cn } from "@/lib/utils";

const plural = (n: number, type: TicketType) => {
  const label = TYPE_LABEL[type].toLowerCase();
  return `${n} ${n === 1 ? label : label === "bus" ? "buses" : `${label}s`}`;
};

/** Trip summary: what's booked, where you sleep each night, and nights still without a stay. */
export function TripOverview({ trip, items }: { trip: Trip; items: Ticket[] }) {
  const stays = items.filter(isStay).sort((a, b) => (a.departureAt ?? "").localeCompare(b.departureAt ?? ""));
  const counts = new Map<TicketType, number>();
  for (const t of items) if (!isStay(t)) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  const covered = new Set(stays.flatMap(stayNights));
  const totalNights = covered.size;

  // Nights of the trip (start date up to the night before the end date) with no hotel booked.
  const open: string[] = [];
  if (trip.startDate && trip.endDate && trip.endDate > trip.startDate) {
    for (let d = parseISO(trip.startDate); format(d, "yyyy-MM-dd") < trip.endDate.slice(0, 10); d = addDays(d, 1)) {
      const k = format(d, "yyyy-MM-dd");
      if (!covered.has(k)) open.push(k);
    }
  }

  if (!items.length) return null;

  return (
    <section className="mb-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {[...counts.entries()].map(([type, n]) => (
          <span key={type} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
            <TypeIcon type={type} className="size-3.5 text-muted-foreground" /> {plural(n, type)}
          </span>
        ))}
        {stays.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
            <BedDouble className="size-3.5 text-muted-foreground" /> {plural(stays.length, "stay")} · {nightsLabel(totalNights) ?? "0 nights"}
          </span>
        )}
      </div>

      {stays.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Where you&apos;re staying</h2>
          <div className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {stays.map((s) => (
              <Link
                key={s.id}
                href={`/tickets/${s.id}`}
                className={cn("relative w-60 shrink-0 snap-start overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md", gradientFor(s))}
              >
                <div className="starfield pointer-events-none absolute inset-0 opacity-50" />
                <div className="relative">
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span className="truncate">{s.destinationName || s.carrier || "Hotel"}</span>
                    <span className="shrink-0">{nightsLabel(nights(s))}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 font-semibold leading-snug">{s.title}</div>
                  <div className="mt-3 font-mono text-xs">{range(s)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {open.length > 0 && (
        <Link href="/add" className="flex items-center gap-3 rounded-2xl border border-dashed p-3 text-sm">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <BedDouble className="size-4 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">
              {open.length === 1 ? "1 night" : `${open.length} nights`} without a stay
            </span>
            <span className="block truncate text-xs text-muted-foreground">{nightList(open)}</span>
          </span>
          <Plus className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}
    </section>
  );
}

function range(s: Ticket) {
  if (!s.departureAt) return "No dates";
  const a = parseISO(s.departureAt);
  if (!s.arrivalAt) return format(a, "EEE d MMM");
  const b = parseISO(s.arrivalAt);
  return a.getMonth() === b.getMonth() ? `${format(a, "d")}–${format(b, "d MMM")}` : `${format(a, "d MMM")} – ${format(b, "d MMM")}`;
}

function nightList(days: string[]) {
  const shown = days.slice(0, 4).map((d) => format(parseISO(d), "EEE d MMM"));
  return days.length > 4 ? `${shown.join(", ")} +${days.length - 4} more` : shown.join(", ");
}
