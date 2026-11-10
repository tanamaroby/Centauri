"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Sparkle } from "lucide-react";
import { useTickets } from "@/lib/client-api";
import { isUpcoming } from "@/lib/format";
import { TicketCard } from "@/components/ticket-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletView() {
  const { data: tickets, isPending, error } = useTickets();
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const all = tickets ?? [];
    const sorted = [...all].sort((a, b) => (a.departureAt ?? "9999").localeCompare(b.departureAt ?? "9999"));
    return {
      upcoming: sorted.filter((t) => isUpcoming(t)),
      past: sorted.filter((t) => !isUpcoming(t)).reverse(),
    };
  }, [tickets]);

  const [next, ...rest] = upcoming;

  return (
    <>
      <PageHeader
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Sparkle className="size-3.5 text-star" /> Centauri
          </span>
        }
        title="Wallet"
        action={
          <Button asChild size="icon" variant="secondary" className="rounded-full">
            <Link href="/add" aria-label="Add ticket"><Plus /></Link>
          </Button>
        }
      />

      {isPending && !tickets ? (
        <div className="space-y-4 px-5">
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ) : error && !tickets ? (
        <EmptyState title="Couldn't load your wallet" description={error.message} />
      ) : !upcoming.length && !past.length ? (
        <EmptyState
          title="Your wallet is empty"
          description="Add a boarding pass, ferry ticket or booking. Upload a PDF or screenshot, or scan its QR code."
          action={<Button asChild variant="star"><Link href="/add"><Plus /> Add your first ticket</Link></Button>}
        />
      ) : (
        <div className="space-y-8 px-5">
          {next && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Next up</h2>
              <TicketCard ticket={next} />
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming</h2>
              <div className="flex flex-col">
                {rest.map((t) => <TicketCard key={t.id} ticket={t} stacked />)}
              </div>
            </section>
          )}
          {!upcoming.length && (
            <p className="text-center text-sm text-muted-foreground">No upcoming tickets. Safe travels on the next one ✨</p>
          )}
          {past.length > 0 && (
            <section>
              <button onClick={() => setShowPast((s) => !s)} className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Past ({past.length}) {showPast ? "▾" : "▸"}
              </button>
              {showPast && (
                <div className="flex flex-col opacity-70 grayscale-[40%]">
                  {past.map((t) => <TicketCard key={t.id} ticket={t} stacked />)}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
