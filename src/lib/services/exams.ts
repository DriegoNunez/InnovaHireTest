import { and, asc, desc, eq, inArray, lt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { type DB, schema } from "@/db";
import { DECISIONS, EXAM_STATUSES, EXPERIENCE_LEVELS, INTEGRITY_EVENT_TYPES, type QuestionSnapshot } from "@/db/schema";
import { suggestDecision } from "@/lib/domain/decision";
import { looksLike } from "@/lib/domain/file-types";
import { assessIntegrity } from "@/lib/domain/integrity";
import { gradeObjective, isObjective, round2, summarizeScore } from "@/lib/domain/scoring";
import { selectBalanced, shuffle } from "@/lib/domain/selection";
import { generateAccessToken, hashToken } from "@/lib/domain/tokens";
import { EXPERIENCE_LABELS } from "@/lib/labels";
import { GradingUnavailableError, type Grader } from "./ai-grader";
import { type Actor, audit, describeZodError, ServiceError } from "./common";
import { appUrl, sendEmail } from "./email";
import { loadQuestionsForSnapshot } from "./questions";

/** Answers arriving this long after the deadline are still accepted (network latency). */
export const DEADLINE_GRACE_MS = 30_000;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;

type Exam = typeof schema.exams.$inferSelect;

export const examLink = (token: string) => `${appUrl()}/exam/${token}`;

// ---------------------------------------------------------------------------
// Creating and managing exams (staff)
// ---------------------------------------------------------------------------

export const createExamInput = z.object({
  candidateId: z.string().uuid(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  questionCount: z.coerce.number().int().min(1, "At least one question").max(100),
  timeLimitMinutes: z.coerce.number().int().min(5).max(480),
  linkValidDays: z.coerce.number().int().min(1).max(30),
  categoryIds: z.array(z.string().uuid()).default([]),
  sendInvitation: z.boolean().default(false),
});

export async function createExam(db: DB, actor: Actor, raw: unknown) {
  const parsed = createExamInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const input = parsed.data;

  const [candidate] = await db.select().from(schema.candidates).where(eq(schema.candidates.id, input.candidateId));
  if (!candidate || candidate.archived) throw new ServiceError("Candidate not found.", "not_found");

  const active = await db
    .select({ id: schema.exams.id })
    .from(schema.exams)
    .where(and(eq(schema.exams.candidateId, candidate.id), inArray(schema.exams.status, ["ready", "in_progress"])));
  if (active.length) throw new ServiceError("This candidate already has an open exam. Revoke it before creating another.", "conflict");

  const where: SQL[] = [eq(schema.questions.status, "published"), eq(schema.questions.experienceLevel, input.experienceLevel)];
  if (input.categoryIds.length) where.push(inArray(schema.questions.categoryId, input.categoryIds));
  const pool = await db
    .select({ id: schema.questions.id, categoryId: schema.questions.categoryId })
    .from(schema.questions)
    .where(and(...where));
  if (pool.length === 0) throw new ServiceError("No published questions match this level and these categories.");

  const picked = selectBalanced(pool, input.questionCount);
  const full = await loadQuestionsForSnapshot(db, picked.map((p) => p.id));
  const byId = new Map(full.map((q) => [q.id, q]));
  const ordered = picked.map((p) => byId.get(p.id)!);
  const totalPoints = ordered.reduce((s, q) => s + q.points, 0);

  const token = generateAccessToken();
  const exam = await db.transaction(async (tx) => {
    const [exam] = await tx
      .insert(schema.exams)
      .values({
        candidateId: candidate.id,
        title: `${EXPERIENCE_LABELS[input.experienceLevel]} structural engineering exam`,
        experienceLevel: input.experienceLevel,
        timeLimitMinutes: input.timeLimitMinutes,
        totalPoints,
        tokenHash: hashToken(token),
        linkExpiresAt: new Date(Date.now() + input.linkValidDays * 86_400_000),
        createdBy: actor?.id ?? null,
      })
      .returning();
    await tx.insert(schema.examQuestions).values(
      ordered.map((q, index) => {
        const snapshot: QuestionSnapshot = {
          type: q.type,
          categoryName: q.categoryName,
          prompt: q.prompt,
          referenceAnswer: q.referenceAnswer,
          explanation: q.explanation,
          allowAttachment: q.allowAttachment,
          figure: q.figureId ? { id: q.figureId, alt: q.figureAlt ?? "" } : null,
          // Option order is shuffled per exam (true/false keeps its natural order).
          options: (q.type === "true_false" ? q.options : shuffle(q.options)).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
          rubric: q.rubric.map((r) => ({ criterion: r.criterion, guidance: r.guidance, maxPoints: r.maxPoints })),
        };
        return { examId: exam.id, questionId: q.id, categoryId: q.categoryId, position: index + 1, points: q.points, snapshot };
      }),
    );
    await audit(tx as unknown as DB, actor, "exam.create", "exam", exam.id, {
      candidateId: candidate.id,
      questions: ordered.length,
      requested: input.questionCount,
    });
    return exam;
  });

  if (input.sendInvitation) await emailInvitation(db, actor, exam, candidate, token);
  return { exam, token, link: examLink(token), shortfall: input.questionCount - ordered.length };
}

async function emailInvitation(db: DB, actor: Actor, exam: Exam, candidate: typeof schema.candidates.$inferSelect, token: string) {
  const result = await sendEmail(db, {
    examId: exam.id,
    to: candidate.email,
    subject: "Your INNOVA technical assessment",
    body: `Hello ${candidate.firstName},

Thank you for your interest in joining INNOVA. As the next step, please complete our technical assessment.

  Link: ${examLink(token)}
  Time limit: ${exam.timeLimitMinutes} minutes (the timer starts when you press "Start")
  Available until: ${exam.linkExpiresAt.toUTCString()}

Before you begin:
  • Use a desktop or laptop with a stable connection and a recent browser.
  • Have a calculator and paper ready; some problems let you upload a photo or PDF of your work.
  • Keep the exam in a single tab. Leaving the page, copying and pasting are recorded.
  • Your answers save automatically. When time runs out the exam is submitted for you.

This link is personal. Please do not share it.

Best regards,
INNOVA Hiring Team`,
  });
  await db.update(schema.exams).set({ invitedAt: new Date(), updatedAt: new Date() }).where(eq(schema.exams.id, exam.id));
  await audit(db, actor, "exam.invite", "exam", exam.id, { to: candidate.email, delivered: result.delivered });
  return result;
}

/** Issues a fresh link (the previous one stops working) and optionally emails it. */
export async function reissueLink(db: DB, actor: Actor, examId: string, opts: { email: boolean; linkValidDays?: number }) {
  const [exam] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
  if (!exam) throw new ServiceError("Exam not found.", "not_found");
  if (exam.status !== "ready" && exam.status !== "in_progress") throw new ServiceError("Links can only be issued for exams that are not finished.");
  const token = generateAccessToken();
  const linkExpiresAt =
    exam.status === "ready" ? new Date(Date.now() + (opts.linkValidDays ?? 7) * 86_400_000) : exam.linkExpiresAt;
  const [updated] = await db
    .update(schema.exams)
    .set({ tokenHash: hashToken(token), linkExpiresAt, updatedAt: new Date() })
    .where(eq(schema.exams.id, examId))
    .returning();
  await audit(db, actor, "exam.link_reissue", "exam", examId);
  let delivered: boolean | undefined;
  if (opts.email) {
    const [candidate] = await db.select().from(schema.candidates).where(eq(schema.candidates.id, exam.candidateId));
    delivered = (await emailInvitation(db, actor, updated, candidate, token)).delivered;
  }
  return { token, link: examLink(token), delivered };
}

export async function revokeExam(db: DB, actor: Actor, examId: string) {
  const [row] = await db
    .update(schema.exams)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(schema.exams.id, examId), inArray(schema.exams.status, ["ready", "in_progress"])))
    .returning({ id: schema.exams.id });
  if (!row) throw new ServiceError("Only exams that are not finished can be revoked.");
  await audit(db, actor, "exam.revoke", "exam", examId);
}

export type ExamFilters = { status?: string; candidateId?: string; search?: string };

export async function listExams(db: DB, f: ExamFilters = {}) {
  const where: SQL[] = [];
  if (f.status && (EXAM_STATUSES as readonly string[]).includes(f.status)) where.push(eq(schema.exams.status, f.status as never));
  if (f.candidateId) where.push(eq(schema.exams.candidateId, f.candidateId));
  if (f.search) {
    const s = `%${f.search.toLowerCase()}%`;
    where.push(
      sql`(lower(${schema.candidates.firstName} || ' ' || ${schema.candidates.lastName}) like ${s} or lower(${schema.candidates.email}) like ${s})`,
    );
  }
  return db
    .select({
      id: schema.exams.id,
      title: schema.exams.title,
      status: schema.exams.status,
      experienceLevel: schema.exams.experienceLevel,
      totalPoints: schema.exams.totalPoints,
      createdAt: schema.exams.createdAt,
      submittedAt: schema.exams.submittedAt,
      linkExpiresAt: schema.exams.linkExpiresAt,
      decision: schema.exams.decision,
      suggestedDecision: schema.exams.suggestedDecision,
      candidateId: schema.candidates.id,
      candidateName: sql<string>`${schema.candidates.firstName} || ' ' || ${schema.candidates.lastName}`,
      candidateEmail: schema.candidates.email,
      earned: sql<number | null>`(select sum(${schema.grades.points}) from ${schema.grades} where ${schema.grades.examId} = ${schema.exams.id})`,
      pendingReview: sql<number>`(select count(*)::int from ${schema.grades} where ${schema.grades.examId} = ${schema.exams.id} and ${schema.grades.needsReview})`,
    })
    .from(schema.exams)
    .innerJoin(schema.candidates, eq(schema.candidates.id, schema.exams.candidateId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.exams.createdAt))
    .limit(500);
}

export async function getExamDetail(db: DB, examId: string) {
  const [exam] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
  if (!exam) return null;
  const [candidate] = await db.select().from(schema.candidates).where(eq(schema.candidates.id, exam.candidateId));
  const questions = await db.select().from(schema.examQuestions).where(eq(schema.examQuestions.examId, examId)).orderBy(asc(schema.examQuestions.position));
  const answers = await db.select().from(schema.answers).where(eq(schema.answers.examId, examId));
  const grades = await db.select().from(schema.grades).where(eq(schema.grades.examId, examId));
  const files = await db
    .select({ id: schema.attachments.id, fileName: schema.attachments.fileName, contentType: schema.attachments.contentType, size: schema.attachments.size })
    .from(schema.attachments)
    .where(eq(schema.attachments.examId, examId));
  const events = await db.select().from(schema.integrityEvents).where(eq(schema.integrityEvents.examId, examId)).orderBy(asc(schema.integrityEvents.occurredAt));
  const reviewers = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const reviewerName = (id: string | null) => reviewers.find((r) => r.id === id)?.name ?? null;

  const items = questions.map((q) => {
    const answer = answers.find((a) => a.examQuestionId === q.id) ?? null;
    const grade = grades.find((g) => g.examQuestionId === q.id) ?? null;
    return {
      ...q,
      answer,
      attachment: answer?.attachmentId ? (files.find((f) => f.id === answer.attachmentId) ?? null) : null,
      grade: grade ? { ...grade, reviewedByName: reviewerName(grade.reviewedBy) } : null,
    };
  });

  const score = summarizeScore(items.map((i) => ({ categoryName: i.snapshot.categoryName, maxPoints: i.points, grade: i.grade })));
  const integrity = assessIntegrity(events);
  return {
    exam: { ...exam, finalizedByName: reviewerName(exam.finalizedBy) },
    candidate,
    items,
    score,
    integrity,
    events,
    suggested: score.complete ? suggestDecision(score.percentage, integrity.level) : null,
  };
}

// ---------------------------------------------------------------------------
// Taking an exam (candidate)
// ---------------------------------------------------------------------------

export type TokenState =
  | { state: "invalid" }
  | { state: "expired" | "revoked" | "finished"; exam: Exam }
  | { state: "ready" | "in_progress"; exam: Exam };

export async function resolveToken(db: DB, token: string): Promise<TokenState> {
  if (!token || token.length < 20 || token.length > 100) return { state: "invalid" };
  const [exam] = await db.select().from(schema.exams).where(eq(schema.exams.tokenHash, hashToken(token)));
  if (!exam) return { state: "invalid" };
  const current = await expireIfOverdue(db, exam);
  if (current.status === "revoked") return { state: "revoked", exam: current };
  if (current.status === "ready") return current.linkExpiresAt < new Date() ? { state: "expired", exam: current } : { state: "ready", exam: current };
  if (current.status === "in_progress") return { state: "in_progress", exam: current };
  return { state: "finished", exam: current };
}

export async function startExam(db: DB, token: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const resolved = await resolveToken(db, token);
  if (resolved.state === "in_progress") return resolved.exam;
  if (resolved.state !== "ready") throw new ServiceError("This exam link can no longer be used.", "forbidden");
  const now = new Date();
  const [exam] = await db
    .update(schema.exams)
    .set({
      status: "in_progress",
      startedAt: now,
      deadlineAt: new Date(now.getTime() + resolved.exam.timeLimitMinutes * 60_000),
      startIp: meta.ip ?? null,
      startUserAgent: meta.userAgent?.slice(0, 400) ?? null,
      updatedAt: now,
    })
    .where(and(eq(schema.exams.id, resolved.exam.id), eq(schema.exams.status, "ready")))
    .returning();
  if (!exam) {
    // Lost a race with a second click; return the attempt that won.
    const [current] = await db.select().from(schema.exams).where(eq(schema.exams.id, resolved.exam.id));
    if (current?.status === "in_progress") return current;
    throw new ServiceError("This exam link can no longer be used.", "forbidden");
  }
  await audit(db, null, "exam.start", "exam", exam.id, { ip: meta.ip ?? null });
  return exam;
}

/** Auto-submits an exam whose deadline (plus grace) has passed. Returns the up-to-date row. */
export async function expireIfOverdue(db: DB, exam: Exam): Promise<Exam> {
  if (exam.status !== "in_progress" || !exam.deadlineAt) return exam;
  if (Date.now() <= exam.deadlineAt.getTime() + DEADLINE_GRACE_MS) return exam;
  return (await submitExam(db, exam.id, { auto: true })) ?? exam;
}

/** Auto-submits every overdue exam. Returns the ids that were submitted. */
export async function sweepOverdueExams(db: DB) {
  const overdue = await db
    .select({ id: schema.exams.id })
    .from(schema.exams)
    .where(and(eq(schema.exams.status, "in_progress"), lt(schema.exams.deadlineAt, new Date(Date.now() - DEADLINE_GRACE_MS))));
  for (const { id } of overdue) await submitExam(db, id, { auto: true });
  return overdue.map((o) => o.id);
}

async function requireActiveExam(db: DB, examId: string) {
  const [exam] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
  if (!exam) throw new ServiceError("Exam not found.", "not_found");
  const current = await expireIfOverdue(db, exam);
  if (current.status !== "in_progress") throw new ServiceError("This exam has ended. Your saved answers were submitted.", "forbidden");
  return current;
}

/** What the candidate sees. Never includes correct answers, reference answers or rubrics. */
export async function getCandidateView(db: DB, examId: string) {
  const [row] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
  if (!row) return null;
  const exam = await expireIfOverdue(db, row);
  const [candidate] = await db
    .select({ firstName: schema.candidates.firstName, lastName: schema.candidates.lastName })
    .from(schema.candidates)
    .where(eq(schema.candidates.id, exam.candidateId));
  const questions = await db.select().from(schema.examQuestions).where(eq(schema.examQuestions.examId, examId)).orderBy(asc(schema.examQuestions.position));
  const answers = await db.select().from(schema.answers).where(eq(schema.answers.examId, examId));
  const files = await db
    .select({ id: schema.attachments.id, fileName: schema.attachments.fileName, contentType: schema.attachments.contentType })
    .from(schema.attachments)
    .where(eq(schema.attachments.examId, examId));

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      status: exam.status,
      timeLimitMinutes: exam.timeLimitMinutes,
      deadlineAt: exam.deadlineAt?.toISOString() ?? null,
      submittedAt: exam.submittedAt?.toISOString() ?? null,
      candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : "",
    },
    questions: questions.map((q) => ({
      id: q.id,
      position: q.position,
      points: q.points,
      type: q.snapshot.type,
      category: q.snapshot.categoryName,
      prompt: q.snapshot.prompt,
      figure: q.snapshot.figure ?? null,
      allowAttachment: q.snapshot.allowAttachment,
      options: q.snapshot.options.map((o) => ({ id: o.id, text: o.text })),
    })),
    answers: answers.map((a) => ({
      examQuestionId: a.examQuestionId,
      selectedOptionIds: a.selectedOptionIds,
      text: a.text ?? "",
      flagged: a.flagged,
      attachment: a.attachmentId ? (files.find((f) => f.id === a.attachmentId) ?? null) : null,
    })),
  };
}

export const saveAnswerInput = z.object({
  examQuestionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()).max(20).default([]),
  text: z.string().max(20_000).default(""),
  attachmentId: z.string().uuid().nullable().default(null),
  flagged: z.boolean().default(false),
});

export async function saveAnswer(db: DB, examId: string, raw: unknown) {
  const parsed = saveAnswerInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const input = parsed.data;
  await requireActiveExam(db, examId);

  const [question] = await db
    .select()
    .from(schema.examQuestions)
    .where(and(eq(schema.examQuestions.id, input.examQuestionId), eq(schema.examQuestions.examId, examId)));
  if (!question) throw new ServiceError("Question not found.", "not_found");

  const snapshot = question.snapshot;
  const validIds = new Set(snapshot.options.map((o) => o.id));
  let selected = [...new Set(input.selectedOptionIds)].filter((id) => validIds.has(id));
  if (snapshot.type !== "multiple_choice") selected = selected.slice(0, 1);
  const objective = isObjective(snapshot.type);

  let attachmentId: string | null = null;
  if (input.attachmentId && snapshot.allowAttachment) {
    const [file] = await db
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(and(eq(schema.attachments.id, input.attachmentId), eq(schema.attachments.examId, examId)));
    if (!file) throw new ServiceError("Attachment not found.", "not_found");
    attachmentId = file.id;
  }

  const values = {
    selectedOptionIds: objective ? selected : [],
    text: objective ? null : input.text,
    attachmentId,
    flagged: input.flagged,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.answers)
    .values({ examId, examQuestionId: question.id, ...values })
    .onConflictDoUpdate({ target: schema.answers.examQuestionId, set: values });
}

export async function addAttachment(db: DB, examId: string, file: { name: string; type: string; bytes: Buffer }) {
  await requireActiveExam(db, examId);
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) throw new ServiceError("Upload a PDF or an image (PNG, JPG, WebP, GIF).");
  if (file.bytes.length === 0) throw new ServiceError("The file is empty.");
  if (file.bytes.length > MAX_ATTACHMENT_BYTES) throw new ServiceError("Files must be 10 MB or smaller.");
  if (!looksLike(file.type, file.bytes)) throw new ServiceError("The file content does not match its type.");
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.attachments)
    .where(eq(schema.attachments.examId, examId));
  if (Number(count) >= 50) throw new ServiceError("Upload limit reached for this exam.");
  const [row] = await db
    .insert(schema.attachments)
    .values({ examId, fileName: file.name.slice(0, 200) || "upload", contentType: file.type, size: file.bytes.length, data: file.bytes })
    .returning({ id: schema.attachments.id, fileName: schema.attachments.fileName, contentType: schema.attachments.contentType });
  return row;
}

export const integrityEventsInput = z
  .array(z.object({ type: z.enum(INTEGRITY_EVENT_TYPES), detail: z.string().max(300).optional(), at: z.string().datetime().optional() }))
  .max(100);

export async function recordIntegrityEvents(db: DB, examId: string, raw: unknown) {
  const parsed = integrityEventsInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError("Invalid events.");
  if (!parsed.data.length) return;
  const [exam] = await db.select({ status: schema.exams.status, startedAt: schema.exams.startedAt }).from(schema.exams).where(eq(schema.exams.id, examId));
  if (!exam || exam.status !== "in_progress") return;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.integrityEvents)
    .where(eq(schema.integrityEvents.examId, examId));
  const room = Math.max(0, 2000 - Number(count));
  const now = Date.now();
  const rows = parsed.data.slice(0, room).map((e) => {
    // Trust client timestamps only within the attempt window.
    const at = e.at ? new Date(e.at).getTime() : now;
    const valid = exam.startedAt && at >= exam.startedAt.getTime() - 60_000 && at <= now + 60_000;
    return { examId, type: e.type, detail: e.detail ?? null, occurredAt: new Date(valid ? at : now) };
  });
  if (rows.length) await db.insert(schema.integrityEvents).values(rows);
}

/** Ends the attempt and auto-grades the choice questions. Idempotent. */
export async function submitExam(db: DB, examId: string, opts: { auto: boolean }) {
  const [exam] = await db
    .update(schema.exams)
    .set({ status: "submitted", submittedAt: new Date(), autoSubmitted: opts.auto, updatedAt: new Date() })
    .where(and(eq(schema.exams.id, examId), eq(schema.exams.status, "in_progress")))
    .returning();
  if (!exam) {
    const [current] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
    return current ?? null;
  }
  await audit(db, null, opts.auto ? "exam.auto_submit" : "exam.submit", "exam", examId);
  await gradeObjectiveQuestions(db, examId);
  await refreshExamStatus(db, examId);
  const [updated] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
  return updated;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

type GradeValues = Omit<typeof schema.grades.$inferInsert, "id" | "examId" | "examQuestionId" | "createdAt">;

/** Inserts or replaces a grade. Human grades are never overwritten by automatic grading. */
async function upsertGrade(db: DB, examId: string, examQuestionId: string, values: GradeValues) {
  const set = { ...values, updatedAt: new Date() };
  await db
    .insert(schema.grades)
    .values({ examId, examQuestionId, ...set })
    .onConflictDoUpdate({
      target: schema.grades.examQuestionId,
      set,
      setWhere: values.source === "human" ? undefined : sql`${schema.grades.source} <> 'human'`,
    });
}

async function loadForGrading(db: DB, examId: string) {
  const questions = await db.select().from(schema.examQuestions).where(eq(schema.examQuestions.examId, examId)).orderBy(asc(schema.examQuestions.position));
  const answers = await db.select().from(schema.answers).where(eq(schema.answers.examId, examId));
  const grades = await db.select().from(schema.grades).where(eq(schema.grades.examId, examId));
  return { questions, answers, grades };
}

export async function gradeObjectiveQuestions(db: DB, examId: string) {
  const { questions, answers } = await loadForGrading(db, examId);
  for (const q of questions) {
    if (!isObjective(q.snapshot.type)) continue;
    const answer = answers.find((a) => a.examQuestionId === q.id);
    const result = gradeObjective(q.snapshot, answer?.selectedOptionIds ?? [], q.points);
    await upsertGrade(db, examId, q.id, { points: result.points, maxPoints: q.points, source: "auto", feedback: result.feedback, needsReview: false });
  }
}

/**
 * One server-log line per AI grading call: exam and question IDs, model, the provider's response
 * ID (to find the call in its logs), tokens, time and result. No candidate details or answer text.
 */
function logGradingTrace(t: {
  examId: string;
  position: number;
  category: string;
  ok: boolean;
  model: string;
  responseId?: string | null;
  usage?: { inputTokens: number; outputTokens: number } | null;
  ms: number;
  attachment: string | null;
  detail: string;
}) {
  if (process.env.NODE_ENV === "test") return;
  const parts = [
    `exam ${t.examId.slice(0, 8)}`,
    `Q${t.position} ${t.category}`,
    t.model,
    t.responseId ?? "no response id",
    t.usage ? `${t.usage.inputTokens.toLocaleString("en-US")} in / ${t.usage.outputTokens.toLocaleString("en-US")} out tokens` : null,
    `${(t.ms / 1000).toFixed(1)} s`,
    t.attachment ? `with ${t.attachment}` : null,
    t.ok ? t.detail : `FAILED: ${t.detail}`,
  ];
  (t.ok ? console.info : console.warn)(`[grading] ${parts.filter(Boolean).join(" · ")}`);
}

/**
 * Drafts grades for written answers with the AI grader. Blank answers get 0 automatically.
 * Answers already graded by a person are skipped; earlier AI drafts are replaced when `regrade` is set.
 */
export async function gradeWrittenQuestions(db: DB, examId: string, grader: Grader | null, opts: { regrade?: boolean } = {}) {
  const [exam] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
  if (!exam || (exam.status !== "submitted" && exam.status !== "graded")) return { graded: 0, failed: 0, errors: [] as string[] };
  const { questions, answers, grades } = await loadForGrading(db, examId);
  let graded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const q of questions) {
    if (isObjective(q.snapshot.type)) continue;
    const existing = grades.find((g) => g.examQuestionId === q.id);
    if (existing?.source === "human") continue;
    if (existing && !opts.regrade) continue;

    const answer = answers.find((a) => a.examQuestionId === q.id);
    const blank = !answer?.text?.trim() && !answer?.attachmentId;
    if (blank) {
      await upsertGrade(db, examId, q.id, { points: 0, maxPoints: q.points, source: "auto", feedback: "No answer submitted.", needsReview: false });
      graded++;
      continue;
    }
    if (!grader) continue;

    let attachment: { fileName: string; contentType: string; data: Buffer } | null = null;
    if (answer?.attachmentId) {
      const [file] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, answer.attachmentId));
      if (file) attachment = { fileName: file.fileName, contentType: file.contentType, data: file.data };
    }

    const trace = { examId, examQuestionId: q.id, questionId: q.questionId, position: q.position, category: q.snapshot.categoryName };
    const started = Date.now();
    try {
      const result = await grader.grade({
        prompt: q.snapshot.prompt,
        figureDescription: q.snapshot.figure?.alt || null,
        referenceAnswer: q.snapshot.referenceAnswer,
        rubric: q.snapshot.rubric,
        experienceLevel: exam.experienceLevel,
        answerText: answer?.text ?? null,
        attachment,
        trace,
      });
      const points = Math.min(round2(result.criteria.reduce((s, c) => s + c.points, 0)), q.points);
      await upsertGrade(db, examId, q.id, {
        points,
        maxPoints: q.points,
        source: "ai",
        feedback: result.feedback,
        criteria: result.criteria,
        confidence: result.confidence,
        concerns: result.concerns,
        model: result.model,
        aiResponseId: result.responseId ?? null,
        needsReview: true,
        reviewedBy: null,
        reviewedAt: null,
      });
      graded++;
      logGradingTrace({
        ...trace,
        ok: true,
        model: result.model,
        responseId: result.responseId,
        usage: result.usage,
        ms: Date.now() - started,
        attachment: attachment?.contentType ?? null,
        detail: `${points}/${q.points} (${result.confidence})${result.concerns.length ? ` · ${result.concerns.length} concern(s)` : ""}`,
      });
    } catch (error) {
      failed++;
      const message = error instanceof GradingUnavailableError ? error.message : `AI grading failed: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      logGradingTrace({ ...trace, ok: false, model: grader.model, ms: Date.now() - started, attachment: attachment?.contentType ?? null, detail: message });
    }
  }
  await refreshExamStatus(db, examId);
  return { graded, failed, errors };
}

/** Full grading pass after submission: choice questions, then AI drafts for written ones. */
export async function processSubmission(db: DB, examId: string, grader: Grader | null) {
  await gradeObjectiveQuestions(db, examId);
  return gradeWrittenQuestions(db, examId, grader);
}

/** Moves an exam between "submitted" and "graded" depending on whether every question has a score. */
export async function refreshExamStatus(db: DB, examId: string) {
  const detail = await getExamDetail(db, examId);
  if (!detail) return;
  const { exam, score, suggested } = detail;
  if (exam.status !== "submitted" && exam.status !== "graded") return;
  await db
    .update(schema.exams)
    .set({ status: score.complete ? "graded" : "submitted", suggestedDecision: suggested, updatedAt: new Date() })
    .where(eq(schema.exams.id, examId));
}

async function requireReviewable(db: DB, examQuestionId: string) {
  const [row] = await db
    .select({ q: schema.examQuestions, status: schema.exams.status })
    .from(schema.examQuestions)
    .innerJoin(schema.exams, eq(schema.exams.id, schema.examQuestions.examId))
    .where(eq(schema.examQuestions.id, examQuestionId));
  if (!row) throw new ServiceError("Question not found.", "not_found");
  if (row.status !== "submitted" && row.status !== "graded") throw new ServiceError("Grades can only be changed after submission and before the review is finalized.");
  return row.q;
}

export const manualGradeInput = z.object({
  points: z.coerce.number().min(0),
  feedback: z.string().trim().max(4000).optional(),
});

export async function setManualGrade(db: DB, actor: NonNullable<Actor>, examQuestionId: string, raw: unknown) {
  const parsed = manualGradeInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const q = await requireReviewable(db, examQuestionId);
  if (parsed.data.points > q.points) throw new ServiceError(`Points cannot exceed ${q.points}.`);
  const [previous] = await db.select().from(schema.grades).where(eq(schema.grades.examQuestionId, examQuestionId));
  await upsertGrade(db, q.examId, q.id, {
    points: round2(parsed.data.points),
    maxPoints: q.points,
    source: "human",
    feedback: parsed.data.feedback || previous?.feedback || null,
    criteria: previous?.criteria ?? null,
    confidence: previous?.confidence ?? null,
    concerns: previous?.concerns ?? null,
    model: previous?.model ?? null,
    needsReview: false,
    reviewedBy: actor.id,
    reviewedAt: new Date(),
  });
  await audit(db, actor, "grade.set", "exam", q.examId, { examQuestionId, from: previous?.points ?? null, to: parsed.data.points, previousSource: previous?.source ?? null });
  await refreshExamStatus(db, q.examId);
}

/** Confirms an AI-drafted grade unchanged. */
export async function acceptAiGrade(db: DB, actor: NonNullable<Actor>, examQuestionId: string) {
  const q = await requireReviewable(db, examQuestionId);
  const [row] = await db
    .update(schema.grades)
    .set({ needsReview: false, reviewedBy: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.grades.examQuestionId, examQuestionId), eq(schema.grades.needsReview, true)))
    .returning({ points: schema.grades.points });
  if (!row) throw new ServiceError("There is no AI grade waiting for review on this question.");
  await audit(db, actor, "grade.accept_ai", "exam", q.examId, { examQuestionId, points: row.points });
  await refreshExamStatus(db, q.examId);
}

export const finalizeInput = z.object({
  decision: z.enum(DECISIONS),
  notes: z.string().trim().max(10_000).optional(),
});

export async function finalizeExam(db: DB, actor: NonNullable<Actor>, examId: string, raw: unknown) {
  const parsed = finalizeInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const detail = await getExamDetail(db, examId);
  if (!detail) throw new ServiceError("Exam not found.", "not_found");
  if (detail.exam.status !== "graded") throw new ServiceError("Every question must be graded before the review can be finalized.");
  if (detail.score.needsReview > 0) throw new ServiceError(`${detail.score.needsReview} AI-drafted grade(s) still need review.`);
  await db
    .update(schema.exams)
    .set({
      status: "finalized",
      decision: parsed.data.decision,
      reviewerNotes: parsed.data.notes || null,
      finalizedBy: actor.id,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.exams.id, examId));
  await audit(db, actor, "exam.finalize", "exam", examId, {
    decision: parsed.data.decision,
    suggested: detail.suggested,
    percentage: detail.score.percentage,
  });
}

export async function reopenReview(db: DB, actor: NonNullable<Actor>, examId: string) {
  const [row] = await db
    .update(schema.exams)
    .set({ status: "graded", finalizedAt: null, finalizedBy: null, updatedAt: new Date() })
    .where(and(eq(schema.exams.id, examId), eq(schema.exams.status, "finalized")))
    .returning({ id: schema.exams.id });
  if (!row) throw new ServiceError("Only finalized exams can be reopened.");
  await audit(db, actor, "exam.reopen", "exam", examId);
}

/** True when the figure is part of a question in this exam (candidates may only load those). */
export async function examShowsFigure(db: DB, examId: string, figureId: string) {
  const rows = await db
    .select({ id: schema.examQuestions.id })
    .from(schema.examQuestions)
    .where(and(eq(schema.examQuestions.examId, examId), sql`${schema.examQuestions.snapshot} -> 'figure' ->> 'id' = ${figureId}`))
    .limit(1);
  return rows.length > 0;
}

export async function getAttachment(db: DB, id: string) {
  const [file] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id));
  return file ?? null;
}
