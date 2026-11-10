import type { TicketType, TicketValues } from "@/lib/types";
import { AIRLINES, AIRPORTS } from "./reference-data";

/**
 * Best-effort heuristics that turn the text of a ticket (from a PDF or OCR) into fields.
 * Everything is shown in an editable form before saving, so it only needs to be "mostly right".
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function detectType(t: string): TicketType {
  const s = t.toLowerCase();
  const score = (words: string[]) => words.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0);
  const scores: [TicketType, number][] = [
    ["flight", score(["flight", "boarding pass", "airline", "airport", "gate", "terminal", "baggage", "e-ticket", "boarding time"])],
    ["boat", score(["ferry", "vessel", "harbour", "harbor", "pier", "port", "boat", "cruise", "sailing", "jetty", "embark", "fast boat", "speedboat"])],
    ["train", score(["train", "rail", "platform", "carriage", "coach no", "shinkansen", "railway", "station"])],
    ["bus", score(["bus ", "coach", "bus station", "shuttle"])],
    ["stay", score(["hotel", "check-in date", "check-out", "reservation", "nights", "room type", "accommodation"])],
    ["event", score(["concert", "admission", "venue", "event", "entry", "museum", "show", "row "])],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "other";
}

type DateHit = { index: number; date: string };

function findDates(t: string): DateHit[] {
  const hits: DateHit[] = [];
  const add = (index: number, y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return;
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2100) return;
    hits.push({ index, date: `${y}-${pad(m)}-${pad(d)}` });
  };
  const mon = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;
  const thisYear = new Date().getFullYear();

  // 2026-11-12
  for (const m of t.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) add(m.index!, +m[1], +m[2], +m[3]);
  // 12 Nov 2026, 12-NOV-26, 12NOV
  for (const m of t.matchAll(/\b(\d{1,2})[\s\-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:[\s\-,]*(\d{2,4}))?\b/gi))
    add(m.index!, m[3] ? +m[3] : thisYear, mon(m[2]), +m[1]);
  // Nov 12, 2026
  for (const m of t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi))
    add(m.index!, +m[3], mon(m[1]), +m[2]);
  // 12/11/2026 (assume day first unless impossible)
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2}|\d{2})\b/g)) {
    const a = +m[1], b = +m[2];
    if (a > 12) add(m.index!, +m[3], b, a);
    else if (b > 12) add(m.index!, +m[3], a, b);
    else add(m.index!, +m[3], b, a);
  }
  hits.sort((a, b) => a.index - b.index);
  return hits;
}

function findTimes(t: string) {
  const out: { index: number; time: string }[] = [];
  for (const m of t.matchAll(/\b([01]?\d|2[0-3])[:.h]([0-5]\d)\s*(am|pm|AM|PM)?(?![\d.])/g)) {
    let h = +m[1];
    const ap = m[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    out.push({ index: m.index!, time: `${pad(h)}:${m[2]}` });
  }
  return out;
}

const first = (t: string, re: RegExp, group = 1) => {
  const m = t.match(re);
  return m?.[group]?.trim() || null;
};

const LABEL_END = String.raw`(?=\s{2,}|\n|$|\s+(?:seat|gate|class|date|from|to|flight|booking|terminal)\b)`;

export function parseTicketText(raw: string): Partial<TicketValues> {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const upper = text.toUpperCase();
  const type = detectType(text);
  const result: Partial<TicketValues> = { type };

  result.bookingRef = first(
    text,
    /(?:booking\s*(?:reference|ref\.?|code|no\.?|number|id)|confirmation\s*(?:code|number|no\.?)?|pnr|reservation\s*(?:code|number|no\.?)|record locator|ticket\s*(?:no\.?|number))\s*[:#]?\s*([A-Z0-9]{5,14})\b/i,
  );
  result.passengerName = first(
    text,
    new RegExp(String.raw`(?:passenger(?:\s*name)?|name of passenger|travell?er|guest(?:\s*name)?)\s*[:\-]?\s*([A-Z][A-Za-z'.\-/]+(?: [A-Z][A-Za-z'.\-/]+){0,4})${LABEL_END}`, "i"),
  );
  result.seat = first(text, /\bseat\s*(?:no\.?|number)?\s*[:\-]?\s*(\d{1,3}[A-K]|[A-Z]?\d{1,3})\b/i);
  result.gate = first(text, /\bgate\s*[:\-]?\s*([A-Z]?\d{1,3}[A-Z]?)\b/i);
  result.terminal = first(text, /\bterminal\s*[:\-]?\s*([A-Z0-9]{1,3})\b/i);
  result.boardingGroup = first(text, /\b(?:boarding\s*)?(?:group|zone)\s*[:\-]?\s*([A-Z0-9]{1,3})\b/i);
  result.cabinClass = first(text, /\b(premium economy|economy|business|first)(?:\s*class)?\b/i)?.replace(/\b\w/g, (c) => c.toUpperCase()) ?? null;
  result.deck = first(text, /\b(?:deck|cabin)\s*(?:no\.?)?\s*[:\-]?\s*([A-Z0-9\- ]{1,12}?)(?=\s{2,}|\n|$)/i);

  // Routes: "SIN → NRT", "SIN - NRT", "(SIN) ... (NRT)"
  const route =
    upper.match(/\b([A-Z]{3})\s*(?:→|->|–|—|-|>|✈|TO)\s*([A-Z]{3})\b/) ??
    (() => {
      const codes = [...upper.matchAll(/\(([A-Z]{3})\)/g)].map((m) => m[1]);
      return codes.length >= 2 ? [null, codes[0], codes[1]] : null;
    })();
  if (route && (type === "flight" || AIRPORTS[route[1]!] || AIRPORTS[route[2]!])) {
    result.origin = route[1];
    result.destination = route[2];
    result.originName = AIRPORTS[route[1]!] ?? null;
    result.destinationName = AIRPORTS[route[2]!] ?? null;
  } else {
    const from = first(text, /\b(?:from|departure port|departs? from|origin|depart(?:ure)?)\s*[:\-]\s*([A-Za-z][A-Za-z .'()\-]{1,40}?)(?=\s{2,}|\n|$|\s+to\b)/i);
    const to = first(text, /\b(?:to|arrival port|arrives? at|destination|arrival)\s*[:\-]\s*([A-Za-z][A-Za-z .'()\-]{1,40}?)(?=\s{2,}|\n|$)/i);
    if (from) result.originName = from;
    if (to) result.destinationName = to;
  }

  // Flight number: prefer a labelled one, else an airline-code-looking token.
  if (type === "flight") {
    const fn =
      upper.match(/\bFLIGHT\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9]{2})\s?(\d{1,4})\b/) ??
      [...upper.matchAll(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/g)].find((m) => AIRLINES[m[1]]);
    if (fn) {
      result.reference = `${fn[1]}${fn[2]}`;
      result.carrier = AIRLINES[fn[1]] ?? fn[1];
    }
  } else {
    result.reference = first(text, /\b(?:vessel|ship|boat|train(?:\s*no\.?)?|service|bus(?:\s*no\.?)?)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9 \-]{1,30}?)(?=\s{2,}|\n|$)/i);
    result.carrier = first(text, /\b(?:operator|operated by|carrier|company)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9 &.\-]{1,40}?)(?=\s{2,}|\n|$)/i);
  }

  // Dates & times: first date + first time after it = departure; next time = arrival.
  const dates = findDates(text);
  const times = findTimes(text);
  if (dates.length) {
    const d0 = dates[0];
    const t0 = times.find((t) => t.index > d0.index) ?? times[0];
    result.departureAt = t0 ? `${d0.date}T${t0.time}` : d0.date;
    const t1 = t0 && times.find((t) => t.index > t0.index && t.time !== t0.time);
    if (t1) {
      const d1 = dates.find((d) => d.index > t0!.index && d.index < t1.index) ?? d0;
      let arrivalDate = d1.date;
      if (d1 === d0 && t1.time < t0!.time) {
        const next = new Date(`${d0.date}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        arrivalDate = next.toISOString().slice(0, 10);
      }
      result.arrivalAt = `${arrivalDate}T${t1.time}`;
    }
  }

  result.title = buildTitle(result, text);
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v != null && v !== "")) as Partial<TicketValues>;
}

export function buildTitle(t: Partial<TicketValues>, fallbackText = "") {
  const route =
    t.origin && t.destination
      ? `${t.origin} → ${t.destination}`
      : t.originName && t.destinationName
        ? `${t.originName} → ${t.destinationName}`
        : null;
  if (t.reference && route) return `${t.reference} · ${route}`;
  if (route) return route;
  if (t.reference) return t.reference;
  const line = fallbackText.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 60);
  return line ?? "New ticket";
}
