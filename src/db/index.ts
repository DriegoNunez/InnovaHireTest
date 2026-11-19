import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export { schema };

/** Driver-agnostic database handle (works with PGlite and node-postgres). */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

type Holder = { promise?: Promise<DB> };
const holder: Holder = ((globalThis as unknown as { __innovaDb?: Holder }).__innovaDb ??= {});

/** PostgreSQL connection string: `DATABASE_URL`, or `POSTGRES_URL` as set by Vercel's database integrations. */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

/**
 * Returns the shared database connection.
 *
 * - `DATABASE_URL` (or `POSTGRES_URL`) set → PostgreSQL via node-postgres (run `npm run db:migrate` on deploy).
 * - otherwise → embedded PGlite persisted under `PGLITE_DIR` (default `./.data/pglite`),
 *   migrated automatically on first use. Intended for local development and demos.
 */
export function getDb(): Promise<DB> {
  holder.promise ??= connect().catch((error) => {
    holder.promise = undefined;
    throw error;
  });
  return holder.promise;
}

async function connect(): Promise<DB> {
  const url = databaseUrl();
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    // Serverless functions each hold their own pool, so keep it small there.
    const defaultSize = process.env.VERCEL ? 3 : 10;
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_SIZE ?? defaultSize) });
    return drizzle(pool, { schema }) as unknown as DB;
  }
  if (process.env.VERCEL) {
    throw new Error(
      "No database configured. On Vercel the embedded database cannot be used: add a Postgres database " +
        "(Storage → Neon) or set DATABASE_URL, then redeploy. See README → Deploy on Vercel.",
    );
  }

  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.PGLITE_DIR ?? "./.data/pglite");
  fs.mkdirSync(dir, { recursive: true });
  return createPgliteDb(dir);
}

/** Creates a PGlite-backed database and applies migrations. `dataDir` undefined → in-memory. */
export async function createPgliteDb(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as DB;
}

/** Applies migrations to the PostgreSQL database in DATABASE_URL. */
export async function migratePostgres(url: string) {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
