import type { Ticket, Trip } from "@/lib/types";
import type { tickets, trips } from "./schema";

type Dates = { createdAt: Date; updatedAt: Date };
const iso = <T extends Dates>(row: T) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

export const serializeTicket = (row: typeof tickets.$inferSelect) => iso(row) as Ticket;
export const serializeTrip = (row: typeof trips.$inferSelect) => iso(row) as Trip;
