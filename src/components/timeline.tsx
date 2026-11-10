"use client";

import Link from "next/link";
import { ArrowRight, BedDouble, LogIn, LogOut, Moon } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { dayKey, fmtDay, fmtTime, gradientFor, TYPE_LABEL } from "@/lib/format";
import { isStay, nights, nightsLabel, stayNights } from "@/lib/stays";
import { TypeIcon } from "@/components/ticket-icon";
import { cn } from "@/lib/utils";

type Entry =
  | { kind: "ticket"; ticket: Ticket; sort: string }
  | { kind: "checkin"; ticket: Ticket; sort: string }
  | { kind: "night"; ticket: Ticket; sort: string; night: number; of: number }
  | { kind: "checkout"; ticket: Ticket; sort: string };

/** Turns tickets into per-day entries. A hotel stay becomes check-in, one entry per night in between, and check-out. */
function entriesByDay(tickets: Ticket[]) {
  const days = new Map<string, Entry[]>();
  const push = (day: string, e: Entry) => days.set(day, [...(days.get(day) ?? []), e]);
  const time = (v: string | null | undefined, fallback: string) => (v?.includes("T") ? v.slice(11, 16) : fallback);

  for (const t of tickets) {
    if (!isStay(t) || !t.departureAt) {
      push(dayKey(t.departureAt), { kind: "ticket", ticket: t, sort: time(t.departureAt, "00:00") });
      continue;
    }
    push(dayKey(t.departureAt), { kind: "checkin", ticket: t, sort: time(t.departureAt, "15:00") });
    const list = stayNights(t);
    list.slice(1).forEach((d, i) => push(d, { kind: "night", ticket: t, sort: "~", night: i + 2, of: list.length }));
    if (t.arrivalAt && dayKey(t.arrivalAt) !== dayKey(t.departureAt)) {
      push(dayKey(t.arrivalAt), { kind: "checkout", ticket: t, sort: time(t.arrivalAt, "11:00") });
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a === "undated" ? 1 : b === "undated" ? -1 : a.localeCompare(b)))
    .map(([day, list]) => [day, list.sort((a, b) => a.sort.localeCompare(b.sort))] as const);
}

/** Day-by-day itinerary of tickets and hotel stays. */
export function Timeline({ tickets }: { tickets: Ticket[] }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ol className="space-y-6">
      {entriesByDay(tickets).map(([day, items]) => (
        <li key={day}>
          <div className={cn("sticky top-[calc(env(safe-area-inset-top)+var(--top-edge))] z-10 -mx-5 mb-2 bg-background px-5 py-2", day < today && "opacity-60")}>
            <h3 className="text-sm font-semibold">{day === "undated" ? "No date" : fmtDay(day, "long")}</h3>
          </div>
          <ol className="relative ml-3 space-y-3 border-l border-border pl-6">
            {items.map((e) => (
              <li key={`${e.kind}-${e.ticket.id}`} className="relative">
                <Dot entry={e} />
                <EntryView entry={e} day={day} />
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function Dot({ entry }: { entry: Entry }) {
  const t = entry.ticket;
  if (entry.kind === "night") {
    return (
      <span className="absolute -left-[33px] top-2 flex size-4 items-center justify-center rounded-full bg-background ring-4 ring-background">
        <Moon className="size-3 text-muted-foreground" />
      </span>
    );
  }
  const Icon = entry.kind === "checkin" ? LogIn : entry.kind === "checkout" ? LogOut : null;
  return (
    <span className={cn("absolute -left-[37px] top-3 flex size-6 items-center justify-center rounded-full bg-gradient-to-br text-white ring-4 ring-background", gradientFor(t))}>
      {Icon ? <Icon className="size-3" /> : <TypeIcon type={t.type} className="size-3" />}
    </span>
  );
}

function EntryView({ entry, day }: { entry: Entry; day: string }) {
  const t = entry.ticket;
  const href = `/tickets/${t.id}`;

  if (entry.kind === "night") {
    return (
      <Link href={href} className="flex items-center gap-2 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
        <BedDouble className="size-3.5 shrink-0" />
        <span className="truncate">
          Staying at <span className="font-medium text-foreground">{t.title}</span>
        </span>
        <span className="ml-auto shrink-0">night {entry.night} of {entry.of}</span>
      </Link>
    );
  }

  if (entry.kind === "checkin") {
    return (
      <Link href={href} className={cn("block overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm transition active:scale-[0.99]", gradientFor(t))}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-sm font-semibold">{fmtTime(t.departureAt) ? `Check-in ${fmtTime(t.departureAt)}` : "Check-in"}</span>
          <span className="shrink-0 text-xs text-white/80">{nightsLabel(nights(t)) ?? TYPE_LABEL.stay}</span>
        </div>
        <div className="mt-1 truncate text-lg font-semibold">{t.title}</div>
        <div className="truncate text-xs text-white/75">
          {[t.roomType, t.guests, t.destinationName].filter(Boolean).join(" · ") || "Hotel stay"}
        </div>
      </Link>
    );
  }

  if (entry.kind === "checkout") {
    return (
      <Link href={href} className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition active:scale-[0.99]">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold">{fmtTime(t.arrivalAt) ? `Check-out by ${fmtTime(t.arrivalAt)}` : "Check-out"}</div>
          <div className="truncate text-sm text-muted-foreground">{t.title}</div>
        </div>
        <LogOut className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  return (
    <Link href={href} className="block rounded-2xl border bg-card p-4 shadow-sm transition active:scale-[0.99]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm font-semibold">{fmtTime(t.departureAt) ?? "All day"}</span>
        <span className="truncate text-xs text-muted-foreground">{t.carrier || TYPE_LABEL[t.type]} {t.reference && `· ${t.reference}`}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 font-medium">
        {t.origin || t.originName ? (
          <>
            <span className="truncate">{t.origin || t.originName}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{t.destination || t.destinationName}</span>
          </>
        ) : (
          <span className="truncate">{t.title}</span>
        )}
      </div>
      {t.arrivalAt && (
        <div className="mt-1 text-xs text-muted-foreground">
          Arrives {dayKey(t.arrivalAt) !== day ? `${fmtDay(t.arrivalAt)} ` : ""}{fmtTime(t.arrivalAt) ?? ""}
        </div>
      )}
    </Link>
  );
}
