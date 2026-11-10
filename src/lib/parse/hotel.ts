import type { TicketValues } from "@/lib/types";
import { findDates, findTimes } from "./text";

/**
 * Heuristics for hotel / accommodation confirmations (Booking.com, Agoda, Airbnb, Expedia,
 * Traveloka, Trip.com, direct hotel emails). Works on PDF text or OCR text.
 */

const PLATFORMS: [RegExp, string][] = [
  [/booking\.com/i, "Booking.com"],
  [/agoda/i, "Agoda"],
  [/airbnb/i, "Airbnb"],
  [/expedia/i, "Expedia"],
  [/hotels\.com/i, "Hotels.com"],
  [/traveloka/i, "Traveloka"],
  [/trip\.com|ctrip/i, "Trip.com"],
  [/tiket\.com/i, "tiket.com"],
  [/klook/i, "Klook"],
  [/vrbo/i, "Vrbo"],
  [/hostelworld/i, "Hostelworld"],
  [/marriott\s*bonvoy/i, "Marriott Bonvoy"],
  [/hilton\s*honors/i, "Hilton Honors"],
  [/\bihg\b/i, "IHG"],
  [/\baccor\b|all\.accor/i, "Accor"],
];

const PROPERTY_WORDS =
  /\b(hotel|resort|inn|suites?|villas?|hostel|lodge|residences?|guest\s?house|homestay|apartments?|ryokan|motel|b&b|bed and breakfast|boutique|retreat|bungalows?|cottage|townhouse|house|home|loft|condo|flat|cabin|chalet|machiya|riad|glamping|camp|hyatt|hilton|marriott|sheraton|westin|novotel|ibis|mercure|pullman|sofitel|accor|ihg|holiday inn|crowne plaza|intercontinental|ritz|four seasons|aman|shangri-la|mandarin oriental|swiss[oô]tel|kempinski|fairmont|radisson|mövenpick|movenpick|ascott|citadines|oyo|reddoorz)\b/i;
const NOT_A_NAME = /\b(booking|confirm|check|polic|cancel|email|www\.|https?:|@|thank|dear|payment|total|price|tax|receipt|invoice|summary|details|number|reservation|guest|room type|important|please|your|from|until)\b/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

const clean = (s: string | null | undefined, max = 80) => {
  const v = s?.replace(/\s+/g, " ").replace(/^[\s:\-–|·,]+|[\s:\-–|·,.]+$/g, "").trim();
  return v ? v.slice(0, max) : null;
};

const first = (t: string, re: RegExp, group = 1) => clean(t.match(re)?.[group]);

/** Dates written without a year ("Fri, Dec 12", "12 Dec"), as Airbnb does. Assumes the next such date. */
function yearlessDates(t: string) {
  const now = new Date();
  const out: { index: number; date: string }[] = [];
  const add = (index: number, m: number, d: number) => {
    if (m < 1 || d < 1 || d > 31) return;
    let y = now.getFullYear();
    if (new Date(y, m - 1, d).getTime() < now.getTime() - 60 * 86400000) y += 1;
    out.push({ index, date: `${y}-${pad(m)}-${pad(d)}` });
  };
  const mon = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;
  for (const m of t.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!,?\s*\d{4})(?!:)/g)) add(m.index!, mon(m[1]), +m[2]);
  for (const m of t.matchAll(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b(?![\s\-,]*\d{2,4})/g)) add(m.index!, mon(m[2]), +m[1]);
  return out;
}

function labelIndex(text: string, re: RegExp) {
  const m = re.exec(text);
  return m ? m.index + m[0].length : -1;
}

function hotelName(text: string, lines: string[]) {
  const labelled =
    first(text, /\b(?:hotel|property|accommodation|hotel name|property name)\s*(?:name)?\s*[:\-]\s*([^\n]{3,80})/i) ??
    first(text, /\b(?:your (?:stay|reservation|booking) (?:at|in)|stay at|reservation at|welcome to)\s+([A-Z][^\n.!,]{2,60})/);
  if (labelled && !NOT_A_NAME.test(labelled)) return labelled;
  const line = lines.find((l) => l.length >= 4 && l.length <= 70 && PROPERTY_WORDS.test(l) && !NOT_A_NAME.test(l) && !/\d{3,}/.test(l));
  return clean(line);
}

function address(text: string, lines: string[], name: string | null) {
  const labelled = first(text, /\b(?:address|location|property address|hotel address)\s*[:\-]?\s*([^\n]{6,140})/i);
  if (labelled && !/^(of|and|for)\b/i.test(labelled)) return labelled;
  // The line right after the hotel name often is the address.
  if (name) {
    const i = lines.findIndex((l) => l.includes(name));
    const next = lines[i + 1];
    if (i >= 0 && next && /\d/.test(next) && /,/.test(next) && !NOT_A_NAME.test(next)) return clean(next, 140);
  }
  const street = lines.find((l) => /\b(jalan|jl\.|street|st\.|road|rd\.?|avenue|ave\.?|blvd|boulevard|lane|straße|strasse|via|rue|calle|soi|moo|chome|dori|gang)\b/i.test(l) && /\d/.test(l) && l.length < 140 && !NOT_A_NAME.test(l));
  return clean(street, 140);
}

function cityFrom(addr: string | null) {
  if (!addr) return null;
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  // Prefer the last part without digits that isn't the country (second to last), else the last.
  const noDigits = parts.filter((p) => !/\d/.test(p));
  const pick = noDigits.length >= 2 ? noDigits[noDigits.length - 2] : noDigits[noDigits.length - 1];
  return clean(pick, 40);
}

function guests(text: string) {
  const adults = text.match(/\b(\d{1,2})\s*adults?\b/i) ?? text.match(/\badults?\s*[:\-]?\s*(\d{1,2})\b/i);
  const kids = text.match(/\b(\d{1,2})\s*(?:child|children|kids?)\b/i) ?? text.match(/\b(?:children|child|kids)\s*[:\-]?\s*(\d{1,2})\b/i);
  if (adults) {
    const a = +adults[1];
    const k = kids ? +kids[1] : 0;
    return `${a} ${a === 1 ? "adult" : "adults"}${k ? `, ${k} ${k === 1 ? "child" : "children"}` : ""}`;
  }
  const g = text.match(/\b(?:guests?|persons?|people|pax|occupancy)\s*[:\-]?\s*(\d{1,2})\b/i) ?? text.match(/\b(\d{1,2})\s*(?:guests?|persons?|people|pax)\b/i);
  return g ? `${g[1]} ${+g[1] === 1 ? "guest" : "guests"}` : null;
}

function roomType(text: string, lines: string[]) {
  const labelled = first(text, /\b(?:room\s*type|room\s*category|accommodation type|unit type|room)\s*[:\-]\s*([^\n]{3,80})/i);
  if (labelled && !/^\d+$/.test(labelled)) return labelled;
  const line = lines.find(
    (l) =>
      l.length < 80 &&
      /\b(deluxe|superior|standard|executive|premier|premium|classic|family|twin|double|king|queen|single|studio|junior|club|ocean|garden|pool|sea|city)\b/i.test(l) &&
      /\b(room|suite|bed|king|twin|double|studio|view|villa|bungalow)\b/i.test(l) &&
      !NOT_A_NAME.test(l.replace(/room type/i, "")),
  );
  return clean(line);
}

export function parseHotelText(raw: string): Partial<TicketValues> {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: Partial<TicketValues> = { type: "stay" };

  const name = hotelName(text, lines);
  out.title = name ?? undefined;
  out.carrier = PLATFORMS.find(([re]) => re.test(text))?.[1] ?? null;
  out.address = address(text, lines, name);
  out.destinationName = cityFrom(out.address);
  out.phone = first(text, /\b(?:phone|tel(?:ephone)?|contact(?: number)?|call)\s*(?:no\.?|number)?\s*[:\-]?\s*(\+?\(?\d[\d\s\-().]{6,20}\d)/i);
  out.roomType = roomType(text, lines);
  out.guests = guests(text);
  out.passengerName = first(
    text,
    /\b(?:guest\s*name|lead guest|main guest|name of guest|booked by|reservation (?:name|under)|booker)\s*[:\-]?\s*([A-Z][A-Za-z'.\-]+(?: [A-Z][A-Za-z'.\-]+){0,4})(?=\s{2,}|\n|$)/i,
  );
  out.bookingRef = first(
    text,
    /\b(?:booking\s*(?:number|no\.?|id|reference|ref\.?|code)|confirmation\s*(?:number|no\.?|code|#)?|reservation\s*(?:number|no\.?|id|code)|itinerary\s*(?:number|no\.?|#)?|order\s*(?:number|no\.?|id))[ :#]*\n?[ ]*(?=[A-Z0-9.\-]*\d)([A-Z0-9][A-Z0-9.\-]{3,22}[A-Z0-9])\b/i,
  );
  out.reference = first(text, /\broom\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z]?\d{1,5}[A-Z]?)\b/i);

  // Check-in / check-out: the first date after each label. Labels may sit side by side
  // ("CHECK-IN  CHECK-OUT" above "12 Dec 2026  15 Dec 2026"), so check-out must come after check-in.
  const dates = [...findDates(text), ...yearlessDates(text)].sort((a, b) => a.index - b.index);
  const times = findTimes(text);
  const ciLabel = labelIndex(text, /check[\s-]*in(?:\s*date)?|arrival(?:\s*date)?|arrive/i);
  const coLabel = labelIndex(text, /check[\s-]*out(?:\s*date)?|departure(?:\s*date)?|depart/i);
  const ci = (ciLabel >= 0 && dates.find((d) => d.index >= ciLabel)) || dates[0];
  if (ci) {
    const co =
      dates.find((d) => d.index >= Math.max(coLabel, ci.index) && d.date > ci.date) ?? dates.find((d) => d.date > ci.date);
    const near = (from: number, skip?: number) => times.find((t) => t.index > from && t.index - from < 160 && t.index !== skip);
    const ciTime = near(ci.index);
    const coTime = co ? near(co.index, ciTime?.index) : undefined;
    out.departureAt = ciTime ? `${ci.date}T${ciTime.time}` : ci.date;
    if (co) out.arrivalAt = coTime && coTime.time !== ciTime?.time ? `${co.date}T${coTime.time}` : co.date;
  }

  if (!out.title) out.title = out.destinationName ? `Stay in ${out.destinationName}` : "Hotel stay";
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null && v !== "")) as Partial<TicketValues>;
}
