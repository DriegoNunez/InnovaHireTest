import { and, desc, eq, gte, sql } from "drizzle-orm";
import { type DB, schema } from "@/db";

export async function getDashboard(db: DB) {
  const statusRows = await db
    .select({ status: schema.exams.status, count: sql<number>`count(*)::int` })
    .from(schema.exams)
    .groupBy(schema.exams.status);
  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.count)])) as Record<string, number>;

  const [{ candidates }] = await db
    .select({ candidates: sql<number>`count(*)::int` })
    .from(schema.candidates)
    .where(eq(schema.candidates.archived, false));
  const [{ published }] = await db
    .select({ published: sql<number>`count(*)::int` })
    .from(schema.questions)
    .where(eq(schema.questions.status, "published"));

  const since = new Date(Date.now() - 90 * 86_400_000);
  const finalized = await db
    .select({
      earned: sql<number>`coalesce((select sum(${schema.grades.points}) from ${schema.grades} where ${schema.grades.examId} = ${schema.exams.id}), 0)`,
      total: schema.exams.totalPoints,
      decision: schema.exams.decision,
    })
    .from(schema.exams)
    .where(and(eq(schema.exams.status, "finalized"), gte(schema.exams.finalizedAt, since)));
  const percentages = finalized.map((f) => (f.total ? (Number(f.earned) / f.total) * 100 : 0));
  const averageScore = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null;
  const decisions = finalized.reduce<Record<string, number>>((acc, f) => {
    if (f.decision) acc[f.decision] = (acc[f.decision] ?? 0) + 1;
    return acc;
  }, {});

  const awaitingReview = await db
    .select({
      id: schema.exams.id,
      candidateName: sql<string>`${schema.candidates.firstName} || ' ' || ${schema.candidates.lastName}`,
      status: schema.exams.status,
      submittedAt: schema.exams.submittedAt,
    })
    .from(schema.exams)
    .innerJoin(schema.candidates, eq(schema.candidates.id, schema.exams.candidateId))
    .where(sql`${schema.exams.status} in ('submitted', 'graded')`)
    .orderBy(schema.exams.submittedAt)
    .limit(10);

  const inProgress = await db
    .select({
      id: schema.exams.id,
      candidateName: sql<string>`${schema.candidates.firstName} || ' ' || ${schema.candidates.lastName}`,
      deadlineAt: schema.exams.deadlineAt,
    })
    .from(schema.exams)
    .innerJoin(schema.candidates, eq(schema.candidates.id, schema.exams.candidateId))
    .where(eq(schema.exams.status, "in_progress"))
    .orderBy(schema.exams.deadlineAt)
    .limit(10);

  return { byStatus, candidates: Number(candidates), published: Number(published), averageScore, finalizedCount: finalized.length, decisions, awaitingReview, inProgress };
}

export async function listAuditLogs(db: DB, opts: { entityId?: string; limit?: number } = {}) {
  return db
    .select()
    .from(schema.auditLogs)
    .where(opts.entityId ? eq(schema.auditLogs.entityId, opts.entityId) : undefined)
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(opts.limit ?? 200);
}
