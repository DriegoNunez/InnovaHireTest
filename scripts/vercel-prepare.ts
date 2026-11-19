// Runs before `next build` (npm "prebuild"). Outside Vercel it does nothing.
// On Vercel it checks the required settings, applies database migrations and
// creates the first admin, so a deployment either works or fails with a clear message.
import "./env";
import { sql } from "drizzle-orm";
import { databaseUrl, getDb, migratePostgres, schema } from "../src/db";
import { seedDatabase } from "../src/db/seed";

if (!process.env.VERCEL) process.exit(0);

const problems: string[] = [];
const url = databaseUrl();
if (!url) {
  problems.push(
    "No database. In the Vercel project open Storage → Create Database → Supabase or Neon and connect it to this project " +
      "(it sets POSTGRES_URL / DATABASE_URL). Or set DATABASE_URL to any PostgreSQL connection string.",
  );
}
if ((process.env.AUTH_SECRET ?? "").length < 32) {
  problems.push("AUTH_SECRET is missing or shorter than 32 characters. Add it under Settings → Environment Variables.");
}
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (password === "change-me-now") {
  problems.push("SEED_ADMIN_PASSWORD is still the example value; choose your own (10+ characters) for a public site.");
}

if (problems.length) {
  console.error("\nINNOVA Hire cannot be deployed yet:\n");
  problems.forEach((p) => console.error(`  • ${p}`));
  console.error("\nFix these in the Vercel project settings, then redeploy. See README → Deploy on Vercel.\n");
  process.exit(1);
}

await migratePostgres(url!);
console.log("Database migrations applied.");

if (email && password) {
  const report = await seedDatabase(await getDb(), {
    admin: { email, password, name: process.env.SEED_ADMIN_NAME || "Administrator" },
    sampleQuestions: process.env.SEED_SAMPLE_QUESTIONS !== "false",
  });
  report.forEach((line) => console.log(line));
} else {
  const [{ count }] = await (await getDb()).select({ count: sql<number>`count(*)::int` }).from(schema.users);
  if (Number(count) === 0) {
    console.error("\nINNOVA Hire cannot be deployed yet:\n");
    console.error("  • No users exist. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (10+ characters) to create the first admin.\n");
    process.exit(1);
  }
  console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set; existing users kept, no sample data loaded.");
}
process.exit(0);
