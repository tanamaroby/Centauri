import Link from "next/link";
import { ArrowRight, Clock, Moon, QrCode } from "lucide-react";
import { isStay, nights, nightsLabel, stayDay, stayStatus } from "@/lib/stays";
import { needsCheckIn } from "@/lib/tickets";
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
  const stay = isStay(ticket);

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
              {stay ? (
                <>
                  <div className="truncate text-sm font-semibold">{ticket.title}</div>
                  <div className="truncate text-xs text-white/70">{ticket.destinationName || ticket.carrier || "Hotel"}</div>
                </>
              ) : (
                <>
                  <div className="truncate text-sm font-semibold">{ticket.carrier || TYPE_LABEL[ticket.type]}</div>
                  <div className="truncate text-xs text-white/70">{ticket.reference || ticket.title}</div>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold">{fmtDay(ticket.departureAt) ?? "No date"}</div>
            {rel && <div className="text-xs text-white/70">{rel}</div>}
          </div>
        </div>

        {stay ? (
          <StaySpan ticket={ticket} />
        ) : hasRoute ? (
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
          <div className="flex min-w-0 gap-4">
            {stay && ticket.roomType && <Field label="Room" value={ticket.roomType} />}
            {stay && ticket.guests && <Field label="Guests" value={ticket.guests} />}
            {!stay && ticket.seat && <Field label="Seat" value={ticket.seat} />}
            {ticket.gate && <Field label="Gate" value={ticket.gate} />}
            {ticket.deck && <Field label="Deck" value={ticket.deck} />}
            {ticket.bookingRef && <Field label="Booking" value={ticket.bookingRef} />}
          </div>
          {stay ? (
            (() => {
              const st = stayStatus(ticket);
              return st ? <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium">{st.label}</span> : null;
            })()
          ) : needsCheckIn(ticket) ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
              <Clock className="size-3" /> Check-in pending
            </span>
          ) : (
            ticket.barcodeData && <QrCode className="size-5 text-white/80" />
          )}
        </div>
      </div>
    </Link>
  );
}

/** Check-in → nights → check-out, for hotel cards. */
export function StaySpan({ ticket, size = "md" }: { ticket: Ticket; size?: "md" | "lg" }) {
  const a = stayDay(ticket.departureAt);
  const b = stayDay(ticket.arrivalAt);
  const n = nightsLabel(nights(ticket));
  const big = size === "lg" ? "text-3xl" : "text-2xl";
  return (
    <div className="mt-6 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-white/60">Check-in</div>
        <div className={cn("truncate font-bold tracking-tight", big)}>{a.day}</div>
        <div className="font-mono text-xs text-white/80">{[a.weekday, a.time && `from ${a.time}`].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="flex flex-col items-center text-white/80">
        <Moon className="size-4" />
        {n && <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium">{n}</span>}
      </div>
      <div className="min-w-0 flex-1 text-right">
        <div className="text-[10px] uppercase tracking-wider text-white/60">Check-out</div>
        <div className={cn("truncate font-bold tracking-tight", big)}>{b.day}</div>
        <div className="font-mono text-xs text-white/80">{[b.weekday, b.time && `by ${b.time}`].filter(Boolean).join(" · ")}</div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-white/60">{label}</div>
      <div className="truncate font-mono font-semibold">{value}</div>
    </div>
  );
}
