import type { TicketValues } from "@/lib/types";
import { AIRLINES, AIRPORTS } from "./reference-data";

/**
 * Parses IATA Bar Coded Boarding Pass (BCBP, Resolution 792) data, the format inside
 * almost every airline boarding pass PDF417/Aztec/QR code. Only the mandatory fields are read.
 */
export type BcbpLeg = {
  pnr: string;
  from: string;
  to: string;
  carrier: string;
  flightNumber: string;
  julianDate: number;
  compartment: string;
  seat: string;
  sequence: string;
};

export type Bcbp = { passengerName: string; legs: BcbpLeg[] };

export function isBcbp(data: string) {
  return /^M[1-4]/.test(data) && data.length >= 60;
}

export function parseBcbp(data: string): Bcbp | null {
  if (!isBcbp(data)) return null;
  const legCount = Number(data[1]);
  const passengerName = data.slice(2, 22).trim();
  const legs: BcbpLeg[] = [];
  let pos = 23;
  for (let i = 0; i < legCount; i++) {
    const leg = data.slice(pos, pos + 37);
    if (leg.length < 37) break;
    const varSize = parseInt(data.slice(pos + 35, pos + 37), 16) || 0;
    legs.push({
      pnr: leg.slice(0, 7).trim(),
      from: leg.slice(7, 10).trim(),
      to: leg.slice(10, 13).trim(),
      carrier: leg.slice(13, 16).trim(),
      flightNumber: leg.slice(16, 21).trim().replace(/^0+(?=\d)/, ""),
      julianDate: Number(leg.slice(21, 24)),
      compartment: leg.slice(24, 25).trim(),
      seat: leg.slice(25, 29).trim().replace(/^0+(?=\d)/, ""),
      sequence: leg.slice(29, 34).trim().replace(/^0+(?=\d)/, ""),
    });
    pos += 37 + varSize;
  }
  return legs.length ? { passengerName, legs } : null;
}

/** BCBP stores only day-of-year; pick the year that puts the flight closest to today. */
export function julianToDate(day: number, now = new Date()) {
  if (!day || day < 1 || day > 366) return null;
  const candidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => {
    const d = new Date(Date.UTC(y, 0, 1));
    d.setUTCDate(day);
    return d;
  });
  candidates.sort((a, b) => Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime()));
  return candidates[0].toISOString().slice(0, 10);
}

const COMPARTMENTS: Record<string, string> = {
  F: "First", A: "First", P: "First", J: "Business", C: "Business", D: "Business", I: "Business", Z: "Business",
  W: "Premium Economy", R: "Premium Economy",
};

function formatName(raw: string) {
  const [last, first] = raw.split("/");
  const cap = (s = "") => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const firstClean = (first ?? "").replace(/\s+(MR|MRS|MS|MISS|MSTR|DR)$/i, "");
  return [cap(firstClean), cap(last)].filter(Boolean).join(" ");
}

export function bcbpToTicket(data: string): Partial<TicketValues> | null {
  const parsed = parseBcbp(data);
  if (!parsed) return null;
  const leg = parsed.legs[0];
  const airline = AIRLINES[leg.carrier];
  return {
    type: "flight",
    title: `${leg.carrier} ${leg.flightNumber} · ${leg.from} → ${leg.to}`,
    carrier: airline ?? leg.carrier,
    reference: `${leg.carrier}${leg.flightNumber}`,
    bookingRef: leg.pnr || null,
    passengerName: formatName(parsed.passengerName) || null,
    origin: leg.from,
    originName: AIRPORTS[leg.from] ?? null,
    destination: leg.to,
    destinationName: AIRPORTS[leg.to] ?? null,
    departureAt: julianToDate(leg.julianDate),
    seat: leg.seat || null,
    cabinClass: COMPARTMENTS[leg.compartment] ?? (leg.compartment ? "Economy" : null),
    boardingGroup: leg.sequence ? `Seq ${leg.sequence}` : null,
  };
}
