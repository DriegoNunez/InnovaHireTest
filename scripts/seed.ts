import "./env";
import { getDb, migratePostgres } from "../src/db";
import { seedDatabase } from "../src/db/seed";

if (process.env.DATABASE_URL) await migratePostgres(process.env.DATABASE_URL);
const db = await getDb();

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) {
  console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (see .env.example).");
  process.exit(1);
}

const report = await seedDatabase(db, {
  admin: { email, password, name: process.env.SEED_ADMIN_NAME || "Administrator" },
  sampleQuestions: process.env.SEED_SAMPLE_QUESTIONS !== "false",
});
report.forEach((line) => console.log(line));
process.exit(0);
