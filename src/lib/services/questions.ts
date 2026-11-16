import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { type DB, schema } from "@/db";
import { EXPERIENCE_LEVELS, QUESTION_STATUSES, QUESTION_TYPES, type QuestionStatus } from "@/db/schema";
import { looksLike } from "@/lib/domain/file-types";
import { isObjective } from "@/lib/domain/scoring";
import { type Actor, audit, describeZodError, ServiceError } from "./common";

const optionInput = z.object({ text: z.string().trim().min(1, "Option text is required"), isCorrect: z.boolean() });
const criterionInput = z.object({
  criterion: z.string().trim().min(1, "Criterion is required"),
  guidance: z.string().trim().optional().default(""),
  maxPoints: z.coerce.number().int().min(1).max(100),
});

export const questionInput = z
  .object({
    categoryId: z.string().uuid("Choose a category"),
    type: z.enum(QUESTION_TYPES),
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    difficulty: z.coerce.number().int().min(1).max(5),
    prompt: z.string().trim().min(10, "Question text must be at least 10 characters").max(10_000),
    referenceAnswer: z.string().trim().max(10_000).optional().default(""),
    explanation: z.string().trim().max(5_000).optional().default(""),
    points: z.coerce.number().int().min(1).max(100),
    allowAttachment: z.boolean().default(false),
    figureId: z.string().uuid().nullable().default(null),
    figureAlt: z.string().trim().max(1_000).optional().default(""),
    status: z.enum(QUESTION_STATUSES).default("draft"),
    options: z.array(optionInput).default([]),
    rubric: z.array(criterionInput).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.figureId && !q.figureAlt)
      ctx.addIssue({ code: "custom", path: ["figureAlt"], message: "Describe the figure (used by screen readers and the AI grader)" });
    if (isObjective(q.type)) {
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (q.type === "true_false" && q.options.length !== 2) ctx.addIssue({ code: "custom", path: ["options"], message: "True/false questions need exactly two options" });
      if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two options" });
      if (q.type === "multiple_choice" ? correct < 1 : correct !== 1)
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: q.type === "multiple_choice" ? "Mark at least one correct option" : "Mark exactly one correct option",
        });
    } else {
      if (q.rubric.length === 0) ctx.addIssue({ code: "custom", path: ["rubric"], message: "Written questions need at least one rubric criterion" });
      const total = q.rubric.reduce((s, c) => s + c.maxPoints, 0);
      if (q.rubric.length && total !== q.points)
        ctx.addIssue({ code: "custom", path: ["rubric"], message: `Rubric points (${total}) must add up to the question's points (${q.points})` });
      if (!q.referenceAnswer) ctx.addIssue({ code: "custom", path: ["referenceAnswer"], message: "Provide a reference answer for graders" });
    }
  });

export type QuestionInput = z.input<typeof questionInput>;

function parse(raw: unknown) {
  const parsed = questionInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const q = parsed.data;
  // Options are meaningless for written questions and vice versa; drop whatever does not apply.
  if (isObjective(q.type)) q.rubric = [];
  else {
    q.options = [];
  }
  if (isObjective(q.type)) q.allowAttachment = false;
  if (!q.figureId) q.figureAlt = "";
  return q;
}

async function assertFigureExists(db: DB, figureId: string | null) {
  if (!figureId) return;
  const [row] = await db.select({ id: schema.figures.id }).from(schema.figures).where(eq(schema.figures.id, figureId));
  if (!row) throw new ServiceError("The figure could not be found. Upload it again.", "not_found");
}

async function writeChildren(db: DB, questionId: string, q: ReturnType<typeof parse>) {
  await db.delete(schema.questionOptions).where(eq(schema.questionOptions.questionId, questionId));
  await db.delete(schema.rubricCriteria).where(eq(schema.rubricCriteria.questionId, questionId));
  if (q.options.length)
    await db.insert(schema.questionOptions).values(q.options.map((o, i) => ({ questionId, text: o.text, isCorrect: o.isCorrect, position: i })));
  if (q.rubric.length)
    await db
      .insert(schema.rubricCriteria)
      .values(q.rubric.map((c, i) => ({ questionId, criterion: c.criterion, guidance: c.guidance || null, maxPoints: c.maxPoints, position: i })));
}

export async function createQuestion(db: DB, actor: Actor, raw: unknown) {
  const q = parse(raw);
  await assertFigureExists(db, q.figureId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.questions)
      .values({
        categoryId: q.categoryId,
        type: q.type,
        experienceLevel: q.experienceLevel,
        difficulty: q.difficulty,
        prompt: q.prompt,
        referenceAnswer: q.referenceAnswer || null,
        explanation: q.explanation || null,
        points: q.points,
        allowAttachment: q.allowAttachment,
        figureId: q.figureId,
        figureAlt: q.figureAlt || null,
        status: q.status,
        createdBy: actor?.id ?? null,
      })
      .returning({ id: schema.questions.id });
    await writeChildren(tx as unknown as DB, row.id, q);
    await audit(tx as unknown as DB, actor, "question.create", "question", row.id, { status: q.status });
    return row;
  });
}

/**
 * Updating a question never changes exams that were already generated: every exam
 * stores a snapshot of its questions.
 */
export async function updateQuestion(db: DB, actor: Actor, id: string, raw: unknown) {
  const q = parse(raw);
  await assertFigureExists(db, q.figureId);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.questions)
      .set({
        categoryId: q.categoryId,
        type: q.type,
        experienceLevel: q.experienceLevel,
        difficulty: q.difficulty,
        prompt: q.prompt,
        referenceAnswer: q.referenceAnswer || null,
        explanation: q.explanation || null,
        points: q.points,
        allowAttachment: q.allowAttachment,
        figureId: q.figureId,
        figureAlt: q.figureAlt || null,
        status: q.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.questions.id, id))
      .returning({ id: schema.questions.id });
    if (!row) throw new ServiceError("Question not found.", "not_found");
    await writeChildren(tx as unknown as DB, id, q);
    await audit(tx as unknown as DB, actor, "question.update", "question", id, { status: q.status });
  });
}

export async function setQuestionStatus(db: DB, actor: Actor, id: string, status: QuestionStatus) {
  const [row] = await db
    .update(schema.questions)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.questions.id, id))
    .returning({ id: schema.questions.id });
  if (!row) throw new ServiceError("Question not found.", "not_found");
  await audit(db, actor, `question.${status}`, "question", id);
}

export type QuestionFilters = {
  search?: string;
  categoryId?: string;
  type?: string;
  level?: string;
  status?: string;
};

export async function listQuestions(db: DB, f: QuestionFilters = {}) {
  const where: SQL[] = [];
  if (f.search) where.push(ilike(schema.questions.prompt, `%${f.search}%`));
  if (f.categoryId) where.push(eq(schema.questions.categoryId, f.categoryId));
  if (f.type && (QUESTION_TYPES as readonly string[]).includes(f.type)) where.push(eq(schema.questions.type, f.type as never));
  if (f.level && (EXPERIENCE_LEVELS as readonly string[]).includes(f.level)) where.push(eq(schema.questions.experienceLevel, f.level as never));
  if (f.status && (QUESTION_STATUSES as readonly string[]).includes(f.status)) where.push(eq(schema.questions.status, f.status as never));
  else where.push(sql`${schema.questions.status} <> 'archived'`);

  return db
    .select({
      id: schema.questions.id,
      prompt: schema.questions.prompt,
      type: schema.questions.type,
      experienceLevel: schema.questions.experienceLevel,
      difficulty: schema.questions.difficulty,
      points: schema.questions.points,
      status: schema.questions.status,
      categoryName: schema.categories.name,
      updatedAt: schema.questions.updatedAt,
    })
    .from(schema.questions)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.questions.categoryId))
    .where(and(...where))
    .orderBy(asc(schema.categories.name), desc(schema.questions.updatedAt))
    .limit(500);
}

export async function getQuestion(db: DB, id: string) {
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
  if (!q) return null;
  const options = await db
    .select()
    .from(schema.questionOptions)
    .where(eq(schema.questionOptions.questionId, id))
    .orderBy(asc(schema.questionOptions.position));
  const rubric = await db
    .select()
    .from(schema.rubricCriteria)
    .where(eq(schema.rubricCriteria.questionId, id))
    .orderBy(asc(schema.rubricCriteria.position));
  return { ...q, options, rubric };
}

export async function listCategories(db: DB) {
  return db.select().from(schema.categories).orderBy(asc(schema.categories.name));
}

export async function createCategory(db: DB, actor: Actor, raw: unknown) {
  const parsed = z
    .object({ name: z.string().trim().min(2, "Name is too short").max(80), description: z.string().trim().max(500).optional() })
    .safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const exists = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.name, parsed.data.name));
  if (exists.length) throw new ServiceError("That category already exists.", "conflict");
  const [row] = await db
    .insert(schema.categories)
    .values({ name: parsed.data.name, description: parsed.data.description || null })
    .returning({ id: schema.categories.id });
  await audit(db, actor, "category.create", "category", row.id, { name: parsed.data.name });
  return row;
}

/** Number of published questions per experience level, used to size exams. */
export async function publishedCounts(db: DB) {
  const rows = await db
    .select({ level: schema.questions.experienceLevel, count: sql<number>`count(*)::int` })
    .from(schema.questions)
    .where(eq(schema.questions.status, "published"))
    .groupBy(schema.questions.experienceLevel);
  return Object.fromEntries(rows.map((r) => [r.level, Number(r.count)])) as Partial<Record<(typeof EXPERIENCE_LEVELS)[number], number>>;
}

export async function loadQuestionsForSnapshot(db: DB, ids: string[]) {
  if (!ids.length) return [];
  const qs = await db
    .select({ q: schema.questions, categoryName: schema.categories.name })
    .from(schema.questions)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.questions.categoryId))
    .where(inArray(schema.questions.id, ids));
  const options = await db.select().from(schema.questionOptions).where(inArray(schema.questionOptions.questionId, ids)).orderBy(asc(schema.questionOptions.position));
  const rubric = await db.select().from(schema.rubricCriteria).where(inArray(schema.rubricCriteria.questionId, ids)).orderBy(asc(schema.rubricCriteria.position));
  return qs.map(({ q, categoryName }) => ({
    ...q,
    categoryName,
    options: options.filter((o) => o.questionId === q.id),
    rubric: rubric.filter((r) => r.questionId === q.id),
  }));
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

export const MAX_FIGURE_BYTES = 5 * 1024 * 1024;
export const FIGURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"] as const;

/** Stores an image for use as a question figure. Returns its id; attach it by saving the question. */
export async function addFigure(db: DB, actor: Actor, file: { name: string; type: string; bytes: Buffer }) {
  if (!(FIGURE_TYPES as readonly string[]).includes(file.type)) throw new ServiceError("Upload an image (PNG, JPG, WebP, GIF or SVG).");
  if (file.bytes.length === 0) throw new ServiceError("The file is empty.");
  if (file.bytes.length > MAX_FIGURE_BYTES) throw new ServiceError("Figures must be 5 MB or smaller.");
  if (!looksLike(file.type, file.bytes)) throw new ServiceError("The file content does not match its type, or the SVG contains scripts.");
  const [row] = await db
    .insert(schema.figures)
    .values({ fileName: file.name.slice(0, 200) || "figure", contentType: file.type, size: file.bytes.length, data: file.bytes, createdBy: actor?.id ?? null })
    .returning({ id: schema.figures.id, fileName: schema.figures.fileName });
  return row;
}

export async function getFigure(db: DB, id: string) {
  const [row] = await db.select().from(schema.figures).where(eq(schema.figures.id, id));
  return row ?? null;
}
