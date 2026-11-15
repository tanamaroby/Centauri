import { AIRPORTS } from "@/lib/parse/reference-data";

/** IANA time zones for the airports in reference-data, so flight times can be scheduled exactly. Extend freely. */
export const AIRPORT_TZ: Record<string, string> = {
  AMS: "Europe/Amsterdam", ATL: "America/New_York", AUH: "Asia/Dubai", BKK: "Asia/Bangkok", BCN: "Europe/Madrid",
  BNE: "Australia/Brisbane", BOS: "America/New_York", BPN: "Asia/Makassar", CDG: "Europe/Paris", CGK: "Asia/Jakarta",
  CAN: "Asia/Shanghai", CNX: "Asia/Bangkok", CTS: "Asia/Tokyo", DAD: "Asia/Ho_Chi_Minh", DEL: "Asia/Kolkata",
  DFW: "America/Chicago", DOH: "Asia/Qatar", DPS: "Asia/Makassar", DXB: "Asia/Dubai", EWR: "America/New_York",
  FCO: "Europe/Rome", FRA: "Europe/Berlin", FUK: "Asia/Tokyo", HAN: "Asia/Ho_Chi_Minh", HKG: "Asia/Hong_Kong",
  HKT: "Asia/Bangkok", HLP: "Asia/Jakarta", HND: "Asia/Tokyo", ICN: "Asia/Seoul", IST: "Europe/Istanbul",
  JFK: "America/New_York", JOG: "Asia/Jakarta", KIX: "Asia/Tokyo", KNO: "Asia/Jakarta", KUL: "Asia/Kuala_Lumpur",
  LAX: "America/Los_Angeles", LGK: "Asia/Kuala_Lumpur", LHR: "Europe/London", LGW: "Europe/London",
  LOP: "Asia/Makassar", MAD: "Europe/Madrid", MEL: "Australia/Melbourne", MNL: "Asia/Manila", MUC: "Europe/Berlin",
  NRT: "Asia/Tokyo", ORD: "America/Chicago", PEN: "Asia/Kuala_Lumpur", PEK: "Asia/Shanghai", PKX: "Asia/Shanghai",
  PVG: "Asia/Shanghai", SFO: "America/Los_Angeles", SEA: "America/Los_Angeles", SGN: "Asia/Ho_Chi_Minh",
  SIN: "Asia/Singapore", SUB: "Asia/Jakarta", SYD: "Australia/Sydney", TPE: "Asia/Taipei", UPG: "Asia/Makassar",
  YIA: "Asia/Jakarta", YVR: "America/Vancouver", YYZ: "America/Toronto", ZRH: "Europe/Zurich", BTH: "Asia/Jakarta",
  TNJ: "Asia/Jakarta", LBJ: "Asia/Makassar", PER: "Australia/Perth", AKL: "Pacific/Auckland", CEB: "Asia/Manila",
  MLE: "Indian/Maldives", CMB: "Asia/Colombo", KTM: "Asia/Kathmandu", OKA: "Asia/Tokyo", NGO: "Asia/Tokyo",
  GMP: "Asia/Seoul",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Best-effort time zone for a place: an airport/port code, or a city name we know from the airport list. */
export function placeTimeZone(code?: string | null, name?: string | null): string | null {
  const c = code?.trim().toUpperCase();
  if (c && AIRPORT_TZ[c]) return AIRPORT_TZ[c];
  const n = name ? norm(name) : "";
  if (n.length < 3) return null;
  for (const [iata, city] of Object.entries(AIRPORTS)) {
    const cn = norm(city);
    if (AIRPORT_TZ[iata] && (n === cn || n.startsWith(cn) || cn.startsWith(n))) return AIRPORT_TZ[iata];
  }
  return null;
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function offsetMs(tz: string, ts: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Converts a wall-clock "YYYY-MM-DDTHH:mm" in `tz` to the real instant. */
export function zonedToUtc(local: string, tz: string): Date {
  const [d, t = "00:00"] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, h, mi);
  let ts = guess - offsetMs(tz, guess);
  // Second pass settles times near a DST change.
  ts = guess - offsetMs(tz, ts);
  return new Date(ts);
}
