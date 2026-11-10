"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";
import { useSaveTrip, useTickets, useTrips } from "@/lib/client-api";
import { tripRange } from "@/lib/format";
import { isStay, nightsLabel, stayNights } from "@/lib/stays";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TripForm } from "@/components/trip-form";
import { TypeIcon } from "@/components/ticket-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export function TripsView() {
  const { data: trips, isPending } = useTrips();
  const { data: tickets } = useTickets();
  const save = useSaveTrip();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        subtitle="Plan"
        title="Trips"
        action={
          <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setOpen(true)} aria-label="New trip">
            <Plus />
          </Button>
        }
      />
      <div className="space-y-3 px-5">
        {isPending && !trips ? (
          <>
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
          </>
        ) : !trips?.length ? (
          <div className="-mx-5">
            <EmptyState
              title="No trips yet"
              description="Group flights, ferries and stays into a trip to see the whole journey on one timeline."
              action={<Button variant="star" onClick={() => setOpen(true)}><Plus /> Plan a trip</Button>}
            />
          </div>
        ) : (
          trips.map((trip) => {
            const items = tickets?.filter((t) => t.tripId === trip.id) ?? [];
            const types = [...new Set(items.map((t) => t.type))];
            const booked = nightsLabel(new Set(items.filter(isStay).flatMap(stayNights)).size);
            return (
              <Link key={trip.id} href={`/trips/${trip.id}`} className="flex items-center gap-4 rounded-3xl border bg-card p-5 shadow-sm transition active:scale-[0.99]">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold">{trip.name}</div>
                  <div className="text-sm text-muted-foreground">{tripRange(trip.startDate, trip.endDate)}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {types.map((t) => <TypeIcon key={t} type={t} className="size-3.5" />)}
                    <span>{items.length} {items.length === 1 ? "item" : "items"}{booked && ` · ${booked} booked`}</span>
                  </div>
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New trip</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <TripForm
              submitLabel="Create trip"
              onSubmit={async (values) => {
                try {
                  await save.mutateAsync({ values });
                  toast.success("Trip created");
                  setOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't create trip");
                }
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
