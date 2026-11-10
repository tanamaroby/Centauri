import "server-only";
import { sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createNeonDb(url: string) {
  return drizzle(neon(url), { schema });
}
type Db = ReturnType<typeof createNeonDb>;

/**
 * Production: Neon Postgres over HTTP (DATABASE_URL).
 * Local dev without DATABASE_URL: an embedded Postgres (PGlite) stored in ./.pglite,
 * so `npm run dev` works with zero setup.
 */
async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return createNeonDb(url);
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is not set");
  const [{ PGlite }, { drizzle: drizzlePglite }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ]);
  console.warn("[centauri] DATABASE_URL not set, using local PGlite database in ./.pglite");
  return drizzlePglite(new PGlite("./.pglite"), { schema }) as unknown as Db;
}

let dbPromise: Promise<Db> | undefined;

/** Returns the database, creating tables on first use (no manual migration step needed). */
export function database() {
  return (dbPromise ??= (async () => {
    const db = await createDb();
    await ensureSchema(db);
    return db;
  })().catch((err) => {
    dbPromise = undefined;
    throw err;
  }));
}

// Mirrors ./schema.ts. drizzle-kit can also manage this: npm run db:push
async function ensureSchema(db: Db) {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    start_date text, end_date text, notes text, color text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL DEFAULT 'other',
    title text NOT NULL,
    carrier text, reference text, booking_ref text, passenger_name text,
    origin text, origin_name text, destination text, destination_name text,
    departure_at text, arrival_at text,
    seat text, gate text, terminal text, cabin_class text, boarding_group text, deck text,
    notes text, barcode_data text, barcode_format text,
    file_url text, file_name text, file_type text,
    trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
    color text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS tickets_departure_idx ON tickets (departure_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS tickets_trip_idx ON tickets (trip_id)`);
}
