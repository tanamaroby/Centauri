import type { Attachment, Ticket, TicketInput, TicketValues } from "@/lib/types";
import { isBcbp } from "@/lib/parse/bcbp";

/** A flight that only has a booking confirmation so far (no boarding pass yet). */
export function needsCheckIn(t: Pick<Ticket, "type" | "checkedIn" | "barcodeData">) {
  return t.type === "flight" && !t.checkedIn && !(t.barcodeData && isBcbp(t.barcodeData));
}

/** All files of a ticket, including the legacy single-file fields. */
export function ticketFiles(t: Pick<Ticket, "attachments" | "fileUrl" | "fileName" | "fileType">): Attachment[] {
  const list = [...(t.attachments ?? [])];
  if (t.fileUrl && !list.some((a) => a.url === t.fileUrl)) {
    list.unshift({ url: t.fileUrl, name: t.fileName ?? "Ticket", type: t.fileType, kind: "other" });
  }
  return list;
}

export const KIND_LABEL: Record<Attachment["kind"], string> = {
  booking: "Booking confirmation",
  boarding: "Boarding pass",
  other: "File",
};

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toUpperCase();

/**
 * Finds the booking a newly scanned boarding pass belongs to: same booking ref, or the same
 * flight number on the same day. Prefers flights still waiting for check-in.
 */
export function findMatchingBooking(tickets: Ticket[], fields: Partial<TicketValues>) {
  if (fields.type !== "flight") return null;
  const ref = norm(fields.bookingRef);
  const flight = norm(fields.reference);
  const day = fields.departureAt?.slice(0, 10);
  const candidates = tickets.filter((t) => {
    if (t.type !== "flight") return false;
    const sameRef = ref && norm(t.bookingRef) === ref;
    const sameFlight = flight && norm(t.reference) === flight && (!day || t.departureAt?.slice(0, 10) === day);
    // A booking ref covers every leg, so also require the flight to match when both are known.
    if (sameRef && flight && norm(t.reference) && norm(t.reference) !== flight) return false;
    return sameRef || sameFlight;
  });
  candidates.sort((a, b) => Number(needsCheckIn(b)) - Number(needsCheckIn(a)));
  return candidates[0] ?? null;
}

/** Fields a boarding pass adds to an existing booking. Booking details already entered are kept. */
export function boardingPassPatch(ticket: Ticket, pass: Partial<TicketValues>, file?: Attachment): Partial<TicketInput> {
  const fill = <K extends keyof TicketValues>(k: K) => (pass[k] != null && pass[k] !== "" ? pass[k] : ticket[k]);
  // BCBP only knows the date; keep the booked time if the day matches.
  const departureAt =
    pass.departureAt && !pass.departureAt.includes("T") && ticket.departureAt?.startsWith(pass.departureAt)
      ? ticket.departureAt
      : (ticket.departureAt ?? pass.departureAt ?? null);
  return {
    barcodeData: pass.barcodeData ?? ticket.barcodeData,
    barcodeFormat: pass.barcodeFormat ?? ticket.barcodeFormat,
    seat: fill("seat"),
    gate: fill("gate"),
    terminal: fill("terminal"),
    boardingGroup: fill("boardingGroup"),
    cabinClass: fill("cabinClass"),
    passengerName: ticket.passengerName ?? pass.passengerName ?? null,
    bookingRef: ticket.bookingRef ?? pass.bookingRef ?? null,
    departureAt,
    checkedIn: true,
    attachments: file ? [...ticketFiles(ticket), file] : ticketFiles(ticket),
  };
}
