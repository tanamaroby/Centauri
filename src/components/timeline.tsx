"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { dayKey, fmtDay, fmtTime, gradientFor, TYPE_LABEL } from "@/lib/format";
import { TypeIcon } from "@/components/ticket-icon";
import { cn } from "@/lib/utils";

/** Day-by-day itinerary of tickets. */
export function Timeline({ tickets }: { tickets: Ticket[] }) {
  const groups = new Map<string, Ticket[]>();
  for (const t of [...tickets].sort((a, b) => (a.departureAt ?? "9999").localeCompare(b.departureAt ?? "9999"))) {
    const k = dayKey(t.departureAt);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ol className="space-y-6">
      {[...groups.entries()].map(([day, items]) => (
        <li key={day}>
          <div className={cn("sticky top-[env(safe-area-inset-top)] z-10 -mx-5 mb-2 bg-background px-5 py-2", day < today && "opacity-60")}>
            <h3 className="text-sm font-semibold">{day === "undated" ? "No date" : fmtDay(day, "long")}</h3>
          </div>
          <ol className="relative ml-3 space-y-3 border-l border-border pl-6">
            {items.map((t) => (
              <li key={t.id} className="relative">
                <span className={cn("absolute -left-[37px] top-3 flex size-6 items-center justify-center rounded-full bg-gradient-to-br text-white ring-4 ring-background", gradientFor(t))}>
                  <TypeIcon type={t.type} className="size-3" />
                </span>
                <Link href={`/tickets/${t.id}`} className="block rounded-2xl border bg-card p-4 shadow-sm transition active:scale-[0.99]">
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
                      {t.type === "stay" ? "Check-out" : "Arrives"} {dayKey(t.arrivalAt) !== day ? `${fmtDay(t.arrivalAt)} ` : ""}{fmtTime(t.arrivalAt) ?? ""}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
