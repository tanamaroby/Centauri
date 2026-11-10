"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useTickets, useTrips } from "@/lib/client-api";
import { isUpcoming } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TimelineView() {
  const { data: tickets, isPending } = useTickets();
  const { data: trips } = useTrips();
  const [filter, setFilter] = useState<string>("upcoming");

  const visible = useMemo(() => {
    const all = tickets ?? [];
    if (filter === "upcoming") return all.filter((t) => isUpcoming(t));
    if (filter === "all") return all;
    return all.filter((t) => t.tripId === filter);
  }, [tickets, filter]);

  const chips = [
    { id: "upcoming", label: "Upcoming" },
    { id: "all", label: "All" },
    ...(trips ?? []).map((t) => ({ id: t.id, label: t.name })),
  ];

  return (
    <>
      <PageHeader subtitle="Schedule" title="Timeline" />
      <div className="mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
              filter === c.id ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="px-5">
        {isPending && !tickets ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : visible.length ? (
          <Timeline tickets={visible} />
        ) : (
          <div className="-mx-5">
            <EmptyState
              title="Nothing scheduled"
              description="Tickets you add show up here, day by day."
              action={<Button asChild variant="star"><Link href="/add"><Plus /> Add ticket</Link></Button>}
            />
          </div>
        )}
      </div>
    </>
  );
}
