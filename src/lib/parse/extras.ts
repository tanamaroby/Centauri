import type { AttachmentKind } from "@/lib/types";

/**
 * Reads the "extras" out of a receipt or add-on confirmation: baggage allowance, the amount paid
 * and what kind of document it is. Pure text heuristics (no network, no AI), like the ticket parser.
 */
export type Extras = {
  kind: AttachmentKind | null;
  /** Suggested label, e.g. "Extra baggage 20 kg". */
  label: string | null;
  baggage: string | null;
  amount: string | null;
};

const CURRENCY = String.raw`(?:[A-Z]{3}|S\$|US\$|A\$|RM|Rp|[$€£¥₩฿₱₹])`;
const MONEY = String.raw`(${CURRENCY})\s?(\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;

function findBaggage(text: string): string | null {
  // "Checked baggage: 1 x 23 kg", "Extra baggage 20kg", "Baggage allowance 30 KG", "2PC"
  const near = /(?:baggage|luggage|bag(?:gage)?\s+allowance|checked\s+bag)[^\n]{0,60}?(\d+\s?x\s?)?(\d{1,2})\s?(kg|kgs|pc|pcs|piece|pieces)\b/i.exec(text);
  const loose = near ?? /\b(\d+\s?x\s?)?(\d{1,2})\s?(kg|kgs)\b/i.exec(text);
  if (!loose) return null;
  const count = loose[1]?.replace(/\s/g, "").replace(/x$/i, "");
  const unit = /^p/i.test(loose[3]) ? (+loose[2] === 1 ? "piece" : "pieces") : "kg";
  const amount = `${loose[2]} ${unit}`;
  return count && count !== "1" ? `${count} × ${amount}` : amount;
}

function findAmount(text: string): string | null {
  const totals = new RegExp(String.raw`(?:grand\s+total|total\s+(?:paid|amount|price|charged)|amount\s+(?:paid|charged)|total|paid)[^\n\d]{0,30}?` + MONEY, "i");
  const m = totals.exec(text) ?? new RegExp(MONEY).exec(text);
  return m ? `${m[1]} ${m[2].replace(/\s/g, "")}` : null;
}

function detectKind(s: string): AttachmentKind | null {
  if (/\b(extra|excess|additional|prepaid|checked)\s+(baggage|luggage|bag)\b|\bbaggage\s+(purchase|allowance|add-?on)\b/.test(s)) return "baggage";
  if (/\b(seat\s+(selection|upgrade|purchase)|upgrade|meal|lounge|insurance|wifi|wi-fi|priority\s+boarding|fast\s+track|add-?on|ancillar)/.test(s)) return "addon";
  if (/\b(receipt|invoice|payment\s+(confirmation|receipt)|proof\s+of\s+(payment|purchase)|tax\s+invoice|transaction)\b/.test(s)) return "receipt";
  if (/\b(booking|reservation|itinerary|e-?ticket)\s+(confirmation|confirmed|receipt)\b/.test(s)) return "booking";
  return null;
}

const ADDON_NAMES: [RegExp, string][] = [
  [/seat\s+upgrade/, "Seat upgrade"],
  [/upgrade/, "Upgrade"],
  [/seat\s+(selection|purchase)/, "Seat selection"],
  [/meal/, "Meal"],
  [/lounge/, "Lounge access"],
  [/insurance/, "Travel insurance"],
  [/wi-?fi/, "Wi-Fi"],
  [/priority\s+boarding/, "Priority boarding"],
  [/fast\s+track/, "Fast track"],
];

export function parseExtras(raw: string): Extras {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const s = text.toLowerCase();
  const kind = detectKind(s);
  const baggage = /bag|luggage|\bkg\b/i.test(text) ? findBaggage(text) : null;
  const amount = findAmount(text);
  let label: string | null = null;
  if (kind === "baggage") label = baggage ? `Extra baggage ${baggage}` : "Extra baggage";
  else if (kind === "addon") label = ADDON_NAMES.find(([re]) => re.test(s))?.[1] ?? "Add-on";
  else if (kind === "receipt") label = "Receipt";
  if (label && amount) label = `${label} · ${amount}`;
  return { kind, label, baggage, amount };
}
