import Link from "next/link";
import { ArrowRight, QrCode } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { duration, fmtDay, fmtTime, gradientFor, relative, TYPE_LABEL } from "@/lib/format";
import { TypeIcon } from "@/components/ticket-icon";
import { cn } from "@/lib/utils";

export function Endpoint({ code, name, time, align = "left" }: { code?: string | null; name?: string | null; time?: string | null; align?: "left" | "right" }) {
  return (
    <div className={cn("min-w-0 flex-1", align === "right" && "text-right")}>
      <div className="truncate text-3xl font-bold tracking-tight">{code || name?.slice(0, 14) || "—"}</div>
      {code && name && <div className="truncate text-xs text-white/70">{name}</div>}
      {time && <div className="mt-0.5 font-mono text-sm text-white/90">{time}</div>}
    </div>
  );
}

/** Wallet-pass style card. `stacked` cards overlap like Apple Wallet. */
export function TicketCard({ ticket, stacked = false, className }: { ticket: Ticket; stacked?: boolean; className?: string }) {
  const hasRoute = ticket.origin || ticket.originName || ticket.destination || ticket.destinationName;
  const dur = duration(ticket.departureAt, ticket.arrivalAt);
  const rel = relative(ticket.departureAt);

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className={cn(
        "relative block overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl shadow-black/30 ring-1 ring-white/10 transition active:scale-[0.99]",
        gradientFor(ticket),
        stacked && "-mb-24 last:mb-0",
        className,
      )}
    >
      <div className="starfield pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15">
              <TypeIcon type={ticket.type} className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{ticket.carrier || TYPE_LABEL[ticket.type]}</div>
              <div className="truncate text-xs text-white/70">{ticket.reference || ticket.title}</div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold">{fmtDay(ticket.departureAt) ?? "No date"}</div>
            {rel && <div className="text-xs text-white/70">{rel}</div>}
          </div>
        </div>

        {hasRoute ? (
          <div className="mt-6 flex items-center gap-3">
            <Endpoint code={ticket.origin} name={ticket.originName} time={fmtTime(ticket.departureAt)} />
            <div className="flex flex-col items-center text-white/70">
              <ArrowRight className="size-5" />
              {dur && <span className="mt-0.5 text-[10px]">{dur}</span>}
            </div>
            <Endpoint code={ticket.destination} name={ticket.destinationName} time={fmtTime(ticket.arrivalAt)} align="right" />
          </div>
        ) : (
          <div className="mt-6">
            <div className="truncate text-2xl font-bold tracking-tight">{ticket.title}</div>
            {fmtTime(ticket.departureAt) && <div className="mt-0.5 font-mono text-sm text-white/90">{fmtTime(ticket.departureAt)}</div>}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-dashed border-white/25 pt-3 text-xs">
          <div className="flex gap-4">
            {ticket.seat && <Field label="Seat" value={ticket.seat} />}
            {ticket.gate && <Field label="Gate" value={ticket.gate} />}
            {ticket.deck && <Field label="Deck" value={ticket.deck} />}
            {ticket.bookingRef && <Field label="Booking" value={ticket.bookingRef} />}
          </div>
          {ticket.barcodeData && <QrCode className="size-5 text-white/80" />}
        </div>
      </div>
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/60">{label}</div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}
