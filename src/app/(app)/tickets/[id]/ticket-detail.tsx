"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Clock, FileText, Map, MapPin, Pencil, Phone, Plus, Sun, Trash2 } from "lucide-react";
import { fileHref, useDeleteTicket, useSaveTicket, useTicket, useTrips } from "@/lib/client-api";
import { duration, fmtDay, fmtTime, gradientFor, relative, TYPE_LABEL } from "@/lib/format";
import { Barcode } from "@/components/barcode";
import { FileViewer } from "@/components/file-viewer";
import { Endpoint, StaySpan } from "@/components/ticket-card";
import { isStay, mapsHref, stayStatus, telHref } from "@/lib/stays";
import { TypeIcon } from "@/components/ticket-icon";
import { TicketForm } from "@/components/ticket-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { AddBoardingPass } from "@/components/add-boarding-pass";
import { KIND_LABEL, needsCheckIn, ticketFiles } from "@/lib/tickets";
import type { Attachment } from "@/lib/types";
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
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const [addingPass, setAddingPass] = useState(false);

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
  const pending = needsCheckIn(ticket);
  const files = ticketFiles(ticket);
  const hasRoute = ticket.origin || ticket.originName || ticket.destination || ticket.destinationName;
  const stay = isStay(ticket);
  const status = stay ? stayStatus(ticket) : null;
  const maps = stay ? mapsHref(ticket) : null;
  const tel = stay ? telHref(ticket.phone) : null;
  const details: [string, string | null][] = stay
    ? [
        ["Guest", ticket.passengerName],
        ["Confirmation", ticket.bookingRef],
        ["Room no.", ticket.reference],
        ["Room type", ticket.roomType],
        ["Guests", ticket.guests],
        ["Booked via", ticket.carrier],
      ]
    : [
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
                  <div className="font-semibold">{stay ? "Hotel" : ticket.carrier || TYPE_LABEL[ticket.type]}</div>
                  <div className="text-xs text-white/70">{stay ? ticket.destinationName : ticket.reference}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{fmtDay(ticket.departureAt) ?? "No date"}</div>
                <div className="text-xs text-white/70">{relative(ticket.departureAt)}</div>
              </div>
            </div>

            <h1 className={cn("mt-5 font-semibold text-white/90", stay ? "text-2xl tracking-tight text-white" : "text-lg")}>{ticket.title}</h1>
            {status && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" /> {status.label}
              </span>
            )}

            {stay ? (
              <StaySpan ticket={ticket} size="lg" />
            ) : hasRoute && (
              <div className="mt-4 flex items-center gap-3">
                <Endpoint code={ticket.origin} name={ticket.originName} time={fmtTime(ticket.departureAt)} />
                <div className="flex flex-col items-center text-white/70">
                  <ArrowRight className="size-5" />
                  {dur && <span className="mt-0.5 text-[10px]">{dur}</span>}
                </div>
                <Endpoint code={ticket.destination} name={ticket.destinationName} time={fmtTime(ticket.arrivalAt)} align="right" />
              </div>
            )}

            <dl className={cn("mt-6 grid gap-x-4 gap-y-3", stay ? "grid-cols-2" : "grid-cols-3")}>
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
        ) : stay ? (
          <div className="p-6 text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/60">Show at the front desk</div>
            <div className="mt-1 font-mono text-2xl font-bold tracking-wider">{ticket.bookingRef ?? "—"}</div>
            {ticket.passengerName && <div className="mt-1 text-xs text-white/70">Booked under {ticket.passengerName}</div>}
          </div>
        ) : pending ? (
          <div className="p-6 text-center">
            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold">
              <Clock className="size-4" /> Not checked in yet
            </div>
            <p className="mt-1 text-xs text-white/70">Add the boarding pass once you check in online or at the counter.</p>
            <Button variant="secondary" className="mt-4 rounded-full" onClick={() => setAddingPass(true)}>
              <Plus /> Add boarding pass
            </Button>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-white/70">
            {ticket.type === "flight" && ticket.checkedIn ? "Checked in. Use your paper boarding pass." : "No barcode on this ticket."}
          </div>
        )}
      </article>

      <div className="mt-5 space-y-3">
        {stay && (ticket.address || maps || tel) && (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {(ticket.address || ticket.destinationName) && (
              <div className="flex items-start gap-3 p-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">Address</div>
                  <div className="font-medium">{ticket.address || ticket.destinationName}</div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 divide-x border-t">
              {maps ? (
                <a href={maps} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 text-sm font-medium text-primary">
                  <Map className="size-4" /> Directions
                </a>
              ) : <span />}
              {tel ? (
                <a href={tel} className="flex items-center justify-center gap-2 p-3 text-sm font-medium text-primary">
                  <Phone className="size-4" /> Call hotel
                </a>
              ) : <span className="flex items-center justify-center p-3 text-sm text-muted-foreground">No phone saved</span>}
            </div>
          </div>
        )}
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
        {files.map((f) => (
          <button key={f.url} onClick={() => setViewing(f)} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left">
            <FileText className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{KIND_LABEL[f.kind]}</div>
              <div className="truncate font-medium">{f.name}</div>
            </div>
          </button>
        ))}
        {ticket.type === "flight" && !pending && (
          <button onClick={() => setAddingPass(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
            <Plus className="size-4" /> {ticket.barcodeData ? "Replace boarding pass" : "Add boarding pass"}
          </button>
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

      {viewing && (
        <FileViewer src={fileHref(viewing.url)} name={viewing.name} type={viewing.type} onClose={() => setViewing(null)} />
      )}

      <AddBoardingPass ticket={ticket} open={addingPass} onOpenChange={setAddingPass} />

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
