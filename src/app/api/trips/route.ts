import { NextResponse, type NextRequest } from "next/server";
import { asc, sql } from "drizzle-orm";
import { database } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { serializeTrip } from "@/lib/db/serialize";
import { tripInputSchema } from "@/lib/types";
import { jsonError, noStore } from "@/lib/api-helpers";

export async function GET() {
  try {
    const db = await database();
    const rows = await db.select().from(trips).orderBy(sql`${trips.startDate} IS NULL`, asc(trips.startDate));
    return NextResponse.json(rows.map(serializeTrip), noStore);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await database();
    const values = tripInputSchema.parse(await request.json());
    const [row] = await db.insert(trips).values(values).returning();
    return NextResponse.json(serializeTrip(row), { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
