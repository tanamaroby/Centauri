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
    list.unshift({ url: t.fileUrl, name: t.fileName ?? "Ticket", type: t.fileType, kind: "other", label: null, addedAt: null });
  }
  return list;
}

export const KIND_LABEL: Record<Attachment["kind"], string> = {
  booking: "Booking confirmation",
  boarding: "Boarding pass",
  receipt: "Receipt / proof of purchase",
  baggage: "Baggage",
  addon: "Add-on",
  other: "File",
};

/** Kinds offered when adding an attachment to an existing ticket. Boarding passes have their own flow. */
export const EXTRA_KINDS: Attachment["kind"][] = ["receipt", "baggage", "addon", "booking", "other"];

/** Title shown for an attachment: its label, else the kind. */
export const attachmentTitle = (a: Attachment) => a.label || KIND_LABEL[a.kind];

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

export type MergeSuggestion = {
  key: keyof TicketValues;
  label: string;
  /** What the ticket has now (null if empty). */
  current: string | null;
  value: string;
  /** Pre-ticked when it only fills a blank; conflicts must be opted in. */
  checked: boolean;
};

const MERGE_FIELDS: [keyof TicketValues, string][] = [
  ["passengerName", "Passenger"],
  ["bookingRef", "Booking ref"],
  ["reference", "Flight / number"],
  ["departureAt", "Departure"],
  ["arrivalAt", "Arrival"],
  ["seat", "Seat"],
  ["gate", "Gate"],
  ["terminal", "Terminal"],
  ["cabinClass", "Class"],
  ["boardingGroup", "Boarding group"],
  ["deck", "Deck / cabin"],
  ["roomType", "Room type"],
  ["guests", "Guests"],
  ["address", "Address"],
  ["phone", "Phone"],
];

/**
 * What a newly attached file could add to the ticket. Only fields the parser actually found,
 * and never the ticket's type or title, since an add-on receipt shouldn't rename the trip.
 */
export function mergeSuggestions(
  ticket: Ticket,
  found: Partial<TicketValues>,
  extras: { baggage: string | null; amount: string | null; label: string | null } | null,
): MergeSuggestion[] {
  const out: MergeSuggestion[] = [];
  for (const [key, label] of MERGE_FIELDS) {
    const value = found[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const current = (ticket[key] as string | null) ?? null;
    if (norm(current) === norm(value)) continue;
    // A date-only departure from a barcode shouldn't replace a booked time on the same day.
    if ((key === "departureAt" || key === "arrivalAt") && current?.startsWith(value)) continue;
    out.push({ key, label, current, value, checked: !current });
  }
  if (found.barcodeData && found.barcodeData !== ticket.barcodeData) {
    out.push({ key: "barcodeData", label: "Barcode", current: ticket.barcodeData ? "Existing code" : null, value: "From this file", checked: !ticket.barcodeData });
  }
  const notes = ticket.notes ?? "";
  // e.g. "Extra baggage 20 kg · SGD 45.00", or just the allowance from a booking.
  const line = extras?.label && extras.amount ? extras.label : extras?.baggage ? `Baggage: ${extras.baggage}` : null;
  const lines = line ? [line] : [];
  const fresh = lines.filter((l) => !notes.toLowerCase().includes(l.toLowerCase()));
  if (fresh.length) out.push({ key: "notes", label: "Add to notes", current: null, value: fresh.join("\n"), checked: true });
  return out;
}

/** Turns the ticked suggestions into a ticket patch. */
export function applySuggestions(ticket: Ticket, picked: MergeSuggestion[], found: Partial<TicketValues>): Partial<TicketInput> {
  const patch: Partial<TicketInput> = {};
  for (const s of picked) {
    if (s.key === "notes") patch.notes = [ticket.notes, s.value].filter(Boolean).join("\n");
    else if (s.key === "barcodeData") {
      patch.barcodeData = found.barcodeData;
      patch.barcodeFormat = found.barcodeFormat;
      if (ticket.type === "flight" && found.barcodeData && isBcbp(found.barcodeData)) patch.checkedIn = true;
    } else (patch as Record<string, unknown>)[s.key] = s.value;
  }
  return patch;
}
