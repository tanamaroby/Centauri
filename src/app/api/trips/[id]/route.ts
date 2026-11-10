import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { database } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { serializeTrip } from "@/lib/db/serialize";
import { tripInputSchema } from "@/lib/types";
import { jsonError } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const db = await database();
    const { id } = await params;
    const body = await request.json();
    const values = tripInputSchema.partial().parse(body);
    const patch = Object.fromEntries(Object.entries(values).filter(([k]) => k in body));
    const [row] = await db
      .update(trips)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(trips.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeTrip(row));
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const db = await database();
    const { id } = await params;
    await db.delete(trips).where(eq(trips.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
