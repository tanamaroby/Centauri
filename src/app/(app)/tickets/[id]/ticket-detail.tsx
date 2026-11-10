"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ExternalLink, Map, Pencil, Sun, Trash2 } from "lucide-react";
import { fileHref, useDeleteTicket, useSaveTicket, useTicket, useTrips } from "@/lib/client-api";
import { duration, fmtDay, fmtTime, gradientFor, relative, TYPE_LABEL } from "@/lib/format";
import { Barcode } from "@/components/barcode";
import { Endpoint } from "@/components/ticket-card";
import { TypeIcon } from "@/components/ticket-icon";
import { TicketForm } from "@/components/ticket-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: ticket, isPending } = useTicket(id);
  const { data: trips } = useTrips();
  const save = useSaveTicket();
  const del = useDeleteTicket();
  const [editing, setEditing] = useState(false);
  const [bright, setBright] = useState(false);

  if (isPending && !ticket) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[480px] rounded-3xl" />
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="pt-10">
        <EmptyState title="Ticket not found" description="It may have been deleted." action={<Button asChild><Link href="/">Back to wallet</Link></Button>} />
      </div>
    );
  }

  const trip = trips?.find((t) => t.id === ticket.tripId);
  const dur = duration(ticket.departureAt, ticket.arrivalAt);
  const hasRoute = ticket.origin || ticket.originName || ticket.destination || ticket.destinationName;
  const details: [string, string | null][] = [
    ["Passenger", ticket.passengerName],
    ["Booking", ticket.bookingRef],
    ["Seat", ticket.seat],
    ["Gate", ticket.gate],
    ["Terminal", ticket.terminal],
    ["Class", ticket.cabinClass],
    ["Boarding", ticket.boardingGroup],
    [ticket.type === "boat" ? "Deck / cabin" : "Carriage", ticket.deck],
  ];

  async function onDelete() {
    if (!confirm("Delete this ticket? This can't be undone.")) return;
    await del.mutateAsync(ticket!.id);
    toast.success("Ticket deleted");
    router.replace("/");
  }

  return (
    <div className="px-5 pt-3">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => (history.length > 1 ? router.back() : router.push("/"))}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" className="rounded-full" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil />
          </Button>
          <Button variant="secondary" size="icon" className="rounded-full text-destructive" onClick={onDelete} aria-label="Delete">
            <Trash2 />
          </Button>
        </div>
      </div>

      <article className={cn("overflow-hidden rounded-3xl bg-gradient-to-br text-white shadow-2xl shadow-black/40 ring-1 ring-white/10", gradientFor(ticket))}>
        <div className="relative p-6">
          <div className="starfield pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                  <TypeIcon type={ticket.type} className="size-5" />
                </span>
                <div>
                  <div className="font-semibold">{ticket.carrier || TYPE_LABEL[ticket.type]}</div>
                  <div className="text-xs text-white/70">{ticket.reference}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{fmtDay(ticket.departureAt) ?? "No date"}</div>
                <div className="text-xs text-white/70">{relative(ticket.departureAt)}</div>
              </div>
            </div>

            <h1 className="mt-5 text-lg font-semibold text-white/90">{ticket.title}</h1>

            {hasRoute && (
              <div className="mt-4 flex items-center gap-3">
                <Endpoint code={ticket.origin} name={ticket.originName} time={fmtTime(ticket.departureAt)} />
                <div className="flex flex-col items-center text-white/70">
                  <ArrowRight className="size-5" />
                  {dur && <span className="mt-0.5 text-[10px]">{dur}</span>}
                </div>
                <Endpoint code={ticket.destination} name={ticket.destinationName} time={fmtTime(ticket.arrivalAt)} align="right" />
              </div>
            )}

            <dl className="mt-6 grid grid-cols-3 gap-x-4 gap-y-3">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wider text-white/60">{k}</dt>
                  <dd className="truncate font-mono text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* perforation */}
        <div className="relative flex items-center">
          <span className="absolute -left-3 size-6 rounded-full bg-background" />
          <span className="mx-5 w-full border-t-2 border-dashed border-white/30" />
          <span className="absolute -right-3 size-6 rounded-full bg-background" />
        </div>

        {ticket.barcodeData ? (
          <button className="block w-full p-6" onClick={() => setBright(true)}>
            <div className="rounded-2xl bg-white p-4">
              <Barcode data={ticket.barcodeData} format={ticket.barcodeFormat} />
            </div>
            <span className="mt-2 flex items-center justify-center gap-1 text-xs text-white/70">
              <Sun className="size-3" /> Tap to enlarge for scanning
            </span>
          </button>
        ) : (
          <div className="p-6 text-center text-sm text-white/70">No barcode on this ticket.</div>
        )}
      </article>

      <div className="mt-5 space-y-3">
        {trip && (
          <Link href={`/trips/${trip.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
            <Map className="size-5 text-primary" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Part of trip</div>
              <div className="font-medium">{trip.name}</div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        )}
        {ticket.fileUrl && (
          <a href={fileHref(ticket.fileUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border bg-card p-4">
            <ExternalLink className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">Original file</div>
              <div className="truncate font-medium">{ticket.fileName ?? "Open file"}</div>
            </div>
          </a>
        )}
        {ticket.notes && (
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-1 text-xs text-muted-foreground">Notes</div>
            <p className="whitespace-pre-wrap text-sm">{ticket.notes}</p>
          </div>
        )}
        {ticket.departureAt && (
          <p className="text-center text-xs text-muted-foreground">{fmtDay(ticket.departureAt, "long")}</p>
        )}
      </div>

      {/* Full-screen barcode on white for gate scanners */}
      {bright && ticket.barcodeData && (
        <button className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-8 pt-safe pb-safe" onClick={() => setBright(false)}>
          <Barcode data={ticket.barcodeData} format={ticket.barcodeFormat} className="max-w-[340px]" />
          <div className="text-center text-black">
            <div className="text-lg font-semibold">{ticket.title}</div>
            {ticket.passengerName && <div className="text-sm text-black/60">{ticket.passengerName}</div>}
            <div className="mt-4 text-xs text-black/50">Turn your screen brightness up · tap to close</div>
          </div>
        </button>
      )}

      <Drawer open={editing} onOpenChange={setEditing} repositionInputs={false}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit ticket</DrawerTitle>
            <DrawerDescription>Changes sync to all your devices.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <TicketForm
              initial={ticket}
              submitLabel="Save changes"
              onSubmit={async (values) => {
                try {
                  await save.mutateAsync({ id: ticket.id, values });
                  toast.success("Saved");
                  setEditing(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't save");
                }
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
