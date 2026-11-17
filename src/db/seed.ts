import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { type DB, schema } from "./index";
import { SAMPLE_CATEGORIES, SAMPLE_QUESTIONS } from "./sample-questions";
import { RETIRED_SAMPLES } from "./sample-questions/retired";
import { audit } from "@/lib/services/common";
import { addFigure, createQuestion } from "@/lib/services/questions";

export type SeedOptions = {
  admin?: { email: string; password: string; name: string };
  sampleQuestions?: boolean;
};

/**
 * Idempotent: creates the first admin (if no user has that email), adds sample questions the
 * bank has not received yet, archives sample questions that were replaced by a newer version,
 * and adds figures to sample questions that do not have one yet.
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
    const added = await loadSampleQuestions(db);
    report.push(added ? `Added ${added} sample question${added === 1 ? "" : "s"}.` : "Sample questions are already loaded.");
    const retired = await retireSampleQuestions(db);
    if (retired) report.push(`Archived ${retired} replaced sample question${retired === 1 ? "" : "s"}.`);
    const uploads = await enableSampleUploads(db);
    if (uploads) report.push(`Turned on photo/PDF answers for ${uploads} sample question${uploads === 1 ? "" : "s"}.`);
    const figures = await attachSampleFigures(db);
    if (figures) report.push(`Added figures to ${figures} sample question${figures === 1 ? "" : "s"}.`);
  }
  return report;
}

/**
 * Adds each sample question the bank has not received yet, as published. Every sample is
 * recorded in the audit log under its key, so one that staff later edit, archive or delete is
 * never added again. A question with exactly the same text counts as already loaded (banks
 * seeded before keys existed).
 */
export async function loadSampleQuestions(db: DB) {
  const loaded = await db
    .select({ key: sql<string>`${schema.auditLogs.details} ->> 'key'` })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.action, "question.sample"));
  const loadedKeys = new Set(loaded.map((r) => r.key));
  const existing = await db.select({ id: schema.questions.id, prompt: schema.questions.prompt }).from(schema.questions);
  const byPrompt = new Map(existing.map((q) => [q.prompt, q.id]));
  const categoryIds = new Map<string, string>();

  let added = 0;
  for (const { key, category, figure: _figure, ...q } of SAMPLE_QUESTIONS) {
    if (loadedKeys.has(key)) continue;
    let id = byPrompt.get(q.prompt);
    if (!id) {
      const categoryId = await categoryIdFor(db, category, categoryIds);
      id = (await createQuestion(db, null, { ...q, categoryId, status: "published" })).id;
      added++;
    }
    await audit(db, null, "question.sample", "question", id, { key });
  }
  return added;
}

/**
 * Archives replaced sample questions (see retired.ts) that are still published with their
 * original text. Exams keep their own copy of each question, so they are unaffected.
 */
export async function retireSampleQuestions(db: DB) {
  let retired = 0;
  for (const { key, prompt } of RETIRED_SAMPLES) {
    const rows = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(and(eq(schema.questions.prompt, prompt), eq(schema.questions.status, "published")));
    for (const { id } of rows) {
      await db.update(schema.questions).set({ status: "archived", updatedAt: new Date() }).where(eq(schema.questions.id, id));
      await audit(db, null, "question.sample_retired", "question", id, { key });
      retired++;
    }
  }
  return retired;
}

/**
 * Turns on photo/PDF answers, once per sample, for written sample questions loaded before
 * uploads were allowed on all of them. Only questions still matching the sample text change,
 * and a question staff later switch back off stays off.
 */
export async function enableSampleUploads(db: DB) {
  const done = await db
    .select({ key: sql<string>`${schema.auditLogs.details} ->> 'key'` })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.action, "question.sample_uploads"));
  const doneKeys = new Set(done.map((r) => r.key));
  let changed = 0;
  for (const sample of SAMPLE_QUESTIONS) {
    if (!sample.allowAttachment || doneKeys.has(sample.key)) continue;
    const rows = await db
      .select({ id: schema.questions.id, allowAttachment: schema.questions.allowAttachment })
      .from(schema.questions)
      .where(and(eq(schema.questions.prompt, sample.prompt), inArray(schema.questions.type, ["short_answer", "long_answer"])));
    for (const row of rows) {
      if (!row.allowAttachment) {
        await db.update(schema.questions).set({ allowAttachment: true, updatedAt: new Date() }).where(eq(schema.questions.id, row.id));
        changed++;
      }
      // Recorded even when already on, so a later choice by staff to turn it off sticks.
      await audit(db, null, "question.sample_uploads", "question", row.id, { key: sample.key });
    }
  }
  return changed;
}

async function categoryIdFor(db: DB, name: string, cache: Map<string, string>) {
  const cached = cache.get(name);
  if (cached) return cached;
  const [found] = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.name, name));
  const description = SAMPLE_CATEGORIES.find((c) => c.name === name)?.description ?? null;
  const id = found?.id ?? (await db.insert(schema.categories).values({ name, description }).returning({ id: schema.categories.id }))[0].id;
  cache.set(name, id);
  return id;
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
