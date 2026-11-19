import "./env";
import { databaseUrl, getDb, migratePostgres } from "../src/db";

const url = databaseUrl();
if (url) {
  await migratePostgres(url);
  console.log("PostgreSQL migrations applied.");
} else {
  await getDb(); // PGlite migrates on open
  console.log(`Embedded database ready at ${process.env.PGLITE_DIR ?? "./.data/pglite"}.`);
}
process.exit(0);
