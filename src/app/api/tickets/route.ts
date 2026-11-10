import { NextResponse, type NextRequest } from "next/server";
import { asc, sql } from "drizzle-orm";
import { database } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { serializeTicket } from "@/lib/db/serialize";
import { ticketInputSchema } from "@/lib/types";
import { jsonError, noStore } from "@/lib/api-helpers";

export async function GET() {
  try {
    const db = await database();
    const rows = await db
      .select()
      .from(tickets)
      .orderBy(sql`${tickets.departureAt} IS NULL`, asc(tickets.departureAt), asc(tickets.createdAt));
    return NextResponse.json(rows.map(serializeTicket), noStore);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await database();
    const values = ticketInputSchema.parse(await request.json());
    const [row] = await db.insert(tickets).values(values).returning();
    return NextResponse.json(serializeTicket(row), { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
