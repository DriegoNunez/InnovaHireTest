import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { type DB, schema } from "./index";
import { SAMPLE_CATEGORIES, SAMPLE_QUESTIONS } from "./sample-questions";
import { createQuestion } from "@/lib/services/questions";

export type SeedOptions = {
  admin?: { email: string; password: string; name: string };
  sampleQuestions?: boolean;
};

/** Idempotent: creates the first admin (if no user has that email) and the sample question bank (if empty). */
export async function seedDatabase(db: DB, opts: SeedOptions) {
  const report: string[] = [];

  if (opts.admin) {
    const email = opts.admin.email.trim().toLowerCase();
    const existing = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`);
    if (existing.length) {
      report.push(`Admin ${email} already exists (unchanged).`);
    } else {
      if (opts.admin.password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
      await db.insert(schema.users).values({
        email,
        name: opts.admin.name,
        role: "admin",
        passwordHash: await bcrypt.hash(opts.admin.password, 12),
      });
      report.push(`Created admin ${email}.`);
    }
  }

  if (opts.sampleQuestions) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.questions);
    if (Number(count) > 0) {
      report.push("Question bank is not empty; sample questions skipped.");
    } else {
      const ids = new Map<string, string>();
      for (const c of SAMPLE_CATEGORIES) {
        const [found] = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.name, c.name));
        const id = found?.id ?? (await db.insert(schema.categories).values(c).returning({ id: schema.categories.id }))[0].id;
        ids.set(c.name, id);
      }
      for (const { category, ...q } of SAMPLE_QUESTIONS) {
        await createQuestion(db, null, { ...q, categoryId: ids.get(category), status: "published" });
      }
      report.push(`Loaded ${SAMPLE_QUESTIONS.length} sample questions in ${SAMPLE_CATEGORIES.length} categories.`);
    }
  }
  return report;
}
