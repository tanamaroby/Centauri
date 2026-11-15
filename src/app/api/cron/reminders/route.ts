import { NextResponse, type NextRequest } from "next/server";
import { jsonError, noStore } from "@/lib/api-helpers";
import { runReminders } from "@/lib/push/server";

/**
 * Scheduler entry point. Called every few minutes by the GitHub Actions workflow
 * (.github/workflows/reminders.yml) or Vercel Cron, with "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runReminders(), noStore);
  } catch (e) {
    return jsonError(e);
  }
}

export const POST = GET;
