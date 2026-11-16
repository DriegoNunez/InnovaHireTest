import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type DB, schema } from "./index";
import { SAMPLE_CATEGORIES, SAMPLE_QUESTIONS } from "./sample-questions";
import { audit } from "@/lib/services/common";
import { addFigure, createQuestion } from "@/lib/services/questions";

export type SeedOptions = {
  admin?: { email: string; password: string; name: string };
  sampleQuestions?: boolean;
};

/**
 * Idempotent: creates the first admin (if no user has that email), the sample question bank
 * (if empty), and adds figures to sample questions that do not have one yet.
 */
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
      for (const { category, figure: _figure, ...q } of SAMPLE_QUESTIONS) {
        await createQuestion(db, null, { ...q, categoryId: ids.get(category), status: "published" });
      }
      report.push(`Loaded ${SAMPLE_QUESTIONS.length} sample questions in ${SAMPLE_CATEGORIES.length} categories.`);
    }
    const added = await attachSampleFigures(db);
    if (added) report.push(`Added figures to ${added} sample question${added === 1 ? "" : "s"}.`);
  }
  return report;
}

const FIGURES_DIR = path.join(process.cwd(), "src", "db", "figures");

/**
 * Gives each sample question its figure when the question (matched by its exact text) has
 * none. Questions that staff edited or gave their own figure are left alone.
 */
export async function attachSampleFigures(db: DB) {
  let added = 0;
  for (const sample of SAMPLE_QUESTIONS) {
    if (!sample.figure) continue;
    const targets = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(and(eq(schema.questions.prompt, sample.prompt), isNull(schema.questions.figureId)));
    if (!targets.length) continue;
    const bytes = fs.readFileSync(path.join(FIGURES_DIR, sample.figure.file));
    const figure = await addFigure(db, null, { name: sample.figure.file, type: "image/svg+xml", bytes });
    for (const { id } of targets) {
      await db.update(schema.questions).set({ figureId: figure.id, figureAlt: sample.figure.alt, updatedAt: new Date() }).where(eq(schema.questions.id, id));
      await audit(db, null, "question.figure", "question", id, { file: sample.figure.file });
      added++;
    }
  }
  return added;
}
