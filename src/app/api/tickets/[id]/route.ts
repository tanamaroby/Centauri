import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { database } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { serializeTicket } from "@/lib/db/serialize";
import { ticketInputSchema } from "@/lib/types";
import { jsonError, noStore } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const db = await database();
    const { id } = await params;
    const [row] = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeTicket(row), noStore);
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const db = await database();
    const { id } = await params;
    const body = await request.json();
    const values = ticketInputSchema.partial().parse(body);
    // Drop keys the client didn't send so a partial update doesn't null other fields.
    const patch = Object.fromEntries(Object.entries(values).filter(([k]) => k in body));
    const [row] = await db
      .update(tickets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeTicket(row));
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const db = await database();
    const { id } = await params;
    const [row] = await db.delete(tickets).where(eq(tickets.id, id)).returning();
    if (row?.fileUrl) await del(row.fileUrl).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
