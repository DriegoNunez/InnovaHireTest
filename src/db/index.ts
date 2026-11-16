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

/**
 * Returns the shared database connection.
 *
 * - `DATABASE_URL` set → PostgreSQL via node-postgres (run `npm run db:migrate` on deploy).
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
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
    return drizzle(pool, { schema }) as unknown as DB;
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
