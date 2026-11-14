import { z } from "zod";

export const TICKET_TYPES = ["flight", "boat", "train", "bus", "stay", "event", "other"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const BARCODE_FORMATS = ["qrcode", "pdf417", "azteccode", "datamatrix", "code128", "ean13"] as const;
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

export const ATTACHMENT_KINDS = ["booking", "boarding", "receipt", "baggage", "addon", "other"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];
export const attachmentSchema = z.object({
  url: z.string().url().max(1000),
  name: z.string().max(300),
  type: z.string().max(200).nullish().transform((v) => v ?? null),
  kind: z.enum(ATTACHMENT_KINDS).catch("other").default("other"),
  /** Optional free-text label, e.g. "Extra 20 kg bag" or "Seat upgrade". */
  label: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
  /** ISO timestamp of when the file was added (missing on older attachments). */
  addedAt: z.string().max(40).nullish().transform((v) => v ?? null),
});
export type Attachment = z.output<typeof attachmentSchema>;

const opt = z.string().trim().max(500).nullish().transform((v) => (v ? v : null));
/** Local wall-clock datetime, "YYYY-MM-DDTHH:mm". Tickets show local times, so no timezone is stored. */
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Use YYYY-MM-DD or YYYY-MM-DDTHH:mm")
  .nullish()
  .transform((v) => (v ? v : null));

export const ticketInputSchema = z.object({
  type: z.enum(TICKET_TYPES).default("other"),
  title: z.string().trim().min(1).max(200),
  carrier: opt,
  reference: opt,
  bookingRef: opt,
  passengerName: opt,
  origin: opt,
  originName: opt,
  destination: opt,
  destinationName: opt,
  departureAt: localDateTime,
  arrivalAt: localDateTime,
  seat: opt,
  gate: opt,
  terminal: opt,
  cabinClass: opt,
  boardingGroup: opt,
  deck: opt,
  /** Hotels: street address, room type, guests ("2 adults") and the property's phone number. */
  address: opt,
  roomType: opt,
  guests: opt,
  phone: opt,
  notes: z.string().trim().max(5000).nullish().transform((v) => (v ? v : null)),
  barcodeData: z.string().max(4000).nullish().transform((v) => (v ? v : null)),
  barcodeFormat: z.enum(BARCODE_FORMATS).nullish().transform((v) => v ?? null),
  fileUrl: opt,
  fileName: opt,
  fileType: opt,
  tripId: z.string().uuid().nullish().transform((v) => v ?? null),
  color: opt,
  /** For flights: false until a boarding pass is attached (booking confirmation only). */
  checkedIn: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(50).default([]),
});
export type TicketInput = z.input<typeof ticketInputSchema>;
export type TicketValues = z.output<typeof ticketInputSchema>;

export type Ticket = TicketValues & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export const tripInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: localDateTime,
  endDate: localDateTime,
  notes: z.string().trim().max(5000).nullish().transform((v) => (v ? v : null)),
  color: opt,
});
export type TripInput = z.input<typeof tripInputSchema>;
export type Trip = z.output<typeof tripInputSchema> & { id: string; createdAt: string; updatedAt: string };
