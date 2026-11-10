"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ListPlus, Pencil, Trash2 } from "lucide-react";
import { useDeleteTrip, useSaveTicket, useSaveTrip, useTickets, useTrips } from "@/lib/client-api";
import { dayKey, fmtDay, tripRange, TYPE_LABEL } from "@/lib/format";
import { Timeline } from "@/components/timeline";
import { TripForm } from "@/components/trip-form";
import { TypeIcon } from "@/components/ticket-icon";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: trips, isPending } = useTrips();
  const { data: tickets } = useTickets();
  const saveTrip = useSaveTrip();
  const delTrip = useDeleteTrip();
  const saveTicket = useSaveTicket();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const trip = trips?.find((t) => t.id === id);
  const items = useMemo(() => tickets?.filter((t) => t.tripId === id) ?? [], [tickets, id]);
  const candidates = useMemo(() => {
    const free = tickets?.filter((t) => t.tripId !== id) ?? [];
    // Tickets inside the trip's dates come first.
    const inRange = (d: string | null) =>
      !!d && !!trip?.startDate && dayKey(d) >= trip.startDate && (!trip.endDate || dayKey(d) <= trip.endDate);
    return free.sort((a, b) => Number(inRange(b.departureAt)) - Number(inRange(a.departureAt)));
  }, [tickets, id, trip]);

  if (isPending && !trip) return <div className="p-5"><Skeleton className="h-40 rounded-3xl" /></div>;
  if (!trip) {
    return (
      <div className="pt-10">
        <EmptyState title="Trip not found" description="It may have been deleted." action={<Button asChild><Link href="/trips">All trips</Link></Button>} />
      </div>
    );
  }

  async function addSelected() {
    await Promise.all([...selected].map((tid) => saveTicket.mutateAsync({ id: tid, values: { tripId: id } })));
    toast.success(`Added ${selected.size} to ${trip!.name}`);
    setSelected(new Set());
    setPicking(false);
  }

  async function onDelete() {
    if (!confirm("Delete this trip? Its tickets stay in your wallet.")) return;
    await delTrip.mutateAsync(id);
    router.replace("/trips");
  }

  return (
    <div className="px-5 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/trips")}><ArrowLeft /> Trips</Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" className="rounded-full" onClick={() => setEditing(true)} aria-label="Edit trip"><Pencil /></Button>
          <Button variant="secondary" size="icon" className="rounded-full text-destructive" onClick={onDelete} aria-label="Delete trip"><Trash2 /></Button>
        </div>
      </div>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
        <p className="text-sm text-muted-foreground">{tripRange(trip.startDate, trip.endDate)}</p>
        {trip.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{trip.notes}</p>}
        <Button className="mt-4" variant="outline" onClick={() => setPicking(true)}><ListPlus /> Add tickets</Button>
      </header>

      {items.length ? (
        <Timeline tickets={items} />
      ) : (
        <div className="-mx-5">
          <EmptyState title="No tickets in this trip" description="Add existing tickets, or pick this trip when adding a new one." />
        </div>
      )}

      <Drawer open={editing} onOpenChange={setEditing} repositionInputs={false}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Edit trip</DrawerTitle></DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <TripForm
              initial={trip}
              onSubmit={async (values) => {
                await saveTrip.mutateAsync({ id, values });
                toast.success("Trip saved");
                setEditing(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={picking} onOpenChange={setPicking}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add tickets</DrawerTitle>
            <DrawerDescription>Tickets within the trip dates are listed first.</DrawerDescription>
          </DrawerHeader>
          <ul className="space-y-2 overflow-y-auto px-4">
            {candidates.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No other tickets.</li>}
            {candidates.map((t) => {
              const on = selected.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected((s) => { const n = new Set(s); if (on) n.delete(t.id); else n.add(t.id); return n; })}
                    className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left", on && "border-primary bg-primary/10")}
                  >
                    <TypeIcon type={t.type} className="size-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{fmtDay(t.departureAt) ?? "No date"} · {TYPE_LABEL[t.type]}</div>
                    </div>
                    <span className={cn("flex size-6 items-center justify-center rounded-full border", on && "border-primary bg-primary text-primary-foreground")}>
                      {on && <Check className="size-4" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="p-4">
            <Button size="lg" className="w-full" disabled={!selected.size || saveTicket.isPending} onClick={addSelected}>
              Add {selected.size || ""} to trip
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
