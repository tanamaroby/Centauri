/** Vercel Blob access mode. Create the Blob store as "Private" (recommended) or set BLOB_ACCESS=public. */
export const blobAccess = (process.env.BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";
