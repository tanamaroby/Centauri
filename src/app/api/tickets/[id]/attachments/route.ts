import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { z } from "zod";
import { database } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { serializeTicket } from "@/lib/db/serialize";
import { ATTACHMENT_KINDS, attachmentSchema, type Attachment } from "@/lib/types";
import { jsonError } from "@/lib/api-helpers";

// Attachment changes run on the server against the stored list, so two devices adding files
// at the same time don't overwrite each other the way a full `attachments` PATCH would.

type Ctx = { params: Promise<{ id: string }> };
type Row = typeof tickets.$inferSelect;

/** The stored list, with a legacy single file (file_url) folded in. */
function filesOf(row: Row): Attachment[] {
  const list = [...(row.attachments ?? [])];
  if (row.fileUrl && !list.some((a) => a.url === row.fileUrl)) {
    list.unshift({ url: row.fileUrl, name: row.fileName ?? "Ticket", type: row.fileType, kind: "other", label: null, addedAt: null });
  }
  return list;
}

async function load(id: string) {
  const db = await database();
  const [row] = await db.select().from(tickets).where(eq(tickets.id, id));
  return { db, row };
}

async function store(db: Awaited<ReturnType<typeof database>>, id: string, attachments: Attachment[]) {
  const [row] = await db
    .update(tickets)
    .set({ attachments, fileUrl: null, fileName: null, fileType: null, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();
  return NextResponse.json(serializeTicket(row));
}

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/** Adds one or more files: { attachments: Attachment[] }. */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = z.object({ attachments: z.array(attachmentSchema).min(1).max(20) }).parse(await request.json());
    const { db, row } = await load(id);
    if (!row) return notFound();
    const list = filesOf(row);
    const now = new Date().toISOString();
    for (const a of body.attachments) {
      if (!list.some((x) => x.url === a.url)) list.push({ ...a, addedAt: a.addedAt ?? now });
    }
    if (list.length > 50) return NextResponse.json({ error: "A ticket can hold up to 50 files" }, { status: 400 });
    return await store(db, id, list);
  } catch (e) {
    return jsonError(e);
  }
}

/** Relabels or recategorises a file: { url, label?, kind? }. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = z
      .object({
        url: z.string().url(),
        label: z.string().trim().max(120).nullish(),
        kind: z.enum(ATTACHMENT_KINDS).optional(),
      })
      .parse(await request.json());
    const { db, row } = await load(id);
    if (!row) return notFound();
    const list = filesOf(row);
    const i = list.findIndex((a) => a.url === body.url);
    if (i < 0) return notFound();
    list[i] = {
      ...list[i],
      ...(body.label !== undefined ? { label: body.label || null } : {}),
      ...(body.kind ? { kind: body.kind } : {}),
    };
    return await store(db, id, list);
  } catch (e) {
    return jsonError(e);
  }
}

/** Removes a file from the ticket and deletes it from storage: ?url=… */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const url = request.nextUrl.searchParams.get("url");
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
    const { db, row } = await load(id);
    if (!row) return notFound();
    const list = filesOf(row);
    const next = list.filter((a) => a.url !== url);
    if (next.length === list.length) return notFound();
    const res = await store(db, id, next);
    // Only blobs we stored for this ticket get deleted, never an arbitrary URL.
    await del(url).catch((e) => console.warn("[centauri] blob delete failed", e));
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
