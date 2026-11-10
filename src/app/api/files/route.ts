import { NextResponse, type NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { blobAccess } from "@/lib/blob";

// Streams a stored ticket file to the logged-in user (works for private Blob stores).
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !/^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\//i.test(url)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  const result = await get(url, { access: blobAccess });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Disposition": result.blob.contentDisposition,
      // Files never change (random suffix), so the browser / service worker can keep them.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
