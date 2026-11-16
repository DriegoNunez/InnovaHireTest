import "./env";
import { getDb, migratePostgres } from "../src/db";

const url = process.env.DATABASE_URL;
if (url) {
  await migratePostgres(url);
  console.log("PostgreSQL migrations applied.");
} else {
  await getDb(); // PGlite migrates on open
  console.log(`Embedded database ready at ${process.env.PGLITE_DIR ?? "./.data/pglite"}.`);
}
process.exit(0);
