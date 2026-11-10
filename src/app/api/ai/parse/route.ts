import { NextResponse, type NextRequest } from "next/server";
import { generateText, Output } from "ai";
import { neon } from "@neon/ai-sdk-provider";
import { z } from "zod";
import { TICKET_TYPES } from "@/lib/types";
import { aiConfigured, aiModelId } from "@/lib/ai";

// Reads a ticket's text with an LLM through the Neon AI Gateway and returns structured fields.
// The client merges these with what it parsed on-device (barcode data always wins).

const nullableString = z.string().nullable().describe("null if not on the ticket");
const fieldsSchema = z.object({
  type: z.enum(TICKET_TYPES),
  title: z.string().describe('Short title, e.g. "SQ638 · SIN → NRT" or "Sanur → Nusa Penida fast boat"'),
  carrier: nullableString.describe("Airline, ferry/train/bus operator, or hotel name"),
  reference: nullableString.describe("Flight number like SQ638, vessel name, train/bus number, or room"),
  bookingRef: nullableString.describe("Booking reference / PNR / confirmation code"),
  passengerName: nullableString.describe("Passenger or guest name, in normal capitalisation"),
  origin: nullableString.describe("3-letter IATA code of departure airport, flights only"),
  originName: nullableString.describe("Departure city, port, station, or venue"),
  destination: nullableString.describe("3-letter IATA code of arrival airport, flights only"),
  destinationName: nullableString.describe("Arrival city, port, or station; or address for stays"),
  departureAt: nullableString.describe("Local departure / check-in time as YYYY-MM-DDTHH:mm, or YYYY-MM-DD if no time"),
  arrivalAt: nullableString.describe("Local arrival / check-out time as YYYY-MM-DDTHH:mm, or YYYY-MM-DD if no time"),
  seat: nullableString,
  gate: nullableString,
  terminal: nullableString,
  cabinClass: nullableString.describe("Economy, Premium Economy, Business, First, or the ticket's class"),
  boardingGroup: nullableString,
  deck: nullableString.describe("Deck / cabin for boats, carriage for trains"),
  notes: nullableString.describe("Useful extras: baggage allowance, meeting point, check-in instructions. Keep it short."),
});

const bodySchema = z.object({
  text: z.string().max(30_000).default(""),
  barcode: z.string().max(4000).nullish(),
  today: z.string().max(20).nullish(),
});

export async function POST(request: NextRequest) {
  if (!aiConfigured()) {
    return NextResponse.json({ error: "AI Gateway is not configured" }, { status: 501 });
  }
  const { text, barcode, today } = bodySchema.parse(await request.json());
  if (!text.trim() && !barcode) return NextResponse.json({ error: "Nothing to read" }, { status: 400 });

  try {
    const { output } = await generateText({
      model: neon(aiModelId()),
      output: Output.object({ schema: fieldsSchema }),
      system:
        "You extract travel ticket and booking details into structured fields. " +
        "Only use information present in the input; use null for anything missing. Never invent booking codes, seats or times. " +
        "Times are local wall-clock times exactly as printed. If a year is missing, assume the next occurrence after today.",
      prompt: [
        `Today is ${today ?? new Date().toISOString().slice(0, 10)}.`,
        barcode ? `Barcode content:\n${barcode}` : null,
        text ? `Ticket text (from PDF extraction or OCR, may be messy):\n${text}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      maxOutputTokens: 1200,
    });
    const fields = Object.fromEntries(Object.entries(output).filter(([, v]) => v !== null && v !== ""));
    return NextResponse.json({ fields, model: aiModelId() });
  } catch (e) {
    console.error("[ai/parse]", e);
    const status = (e as { statusCode?: number }).statusCode;
    const message =
      status === 403
        ? "AI Gateway has no credits yet. Add credits in Neon Billing to enable AI reading."
        : e instanceof Error
          ? e.message
          : "AI reading failed";
    return NextResponse.json({ error: message }, { status: status === 403 ? 402 : 502 });
  }
}
