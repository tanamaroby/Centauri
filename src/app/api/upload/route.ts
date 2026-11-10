import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { jsonError } from "@/lib/api-helpers";

// Issues short-lived client upload tokens. This route sits behind the auth proxy,
// so only a logged-in session can request one. Files go straight from the phone to Blob,
// which avoids the 4.5 MB serverless request body limit.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf", "image/*"],
        maximumSizeInBytes: 25 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
