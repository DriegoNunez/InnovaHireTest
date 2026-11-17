import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { DECISIONS } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, ExamStatusBadge, formatDate, PageHeader } from "@/components/ui";
import { can, rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { DECISION_LABELS } from "@/lib/domain/decision";
import { INTEGRITY_LABELS } from "@/lib/domain/integrity";
import { isObjective } from "@/lib/domain/scoring";
import { scheduleGrading } from "@/lib/grading-jobs";
import { EXPERIENCE_LABELS, QUESTION_TYPE_LABELS } from "@/lib/labels";
import { getConfiguredGrader } from "@/lib/services/ai-grader";
import { expireIfOverdue, getExamDetail } from "@/lib/services/exams";
import { finalizeAction, reissueLinkAction, reopenAction, revokeExamAction, runAiGradingAction } from "../actions";
import { LinkPanel } from "./link-panel";
import { QuestionReview } from "./question-review";

export const metadata: Metadata = { title: "Exam" };

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(rolesFor("viewResults"));
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();

  let detail = await getExamDetail(db, id);
  if (!detail) notFound();
  if (detail.exam.status === "in_progress") {
    const updated = await expireIfOverdue(db, detail.exam);
    if (updated.status !== "in_progress") {
      scheduleGrading([id]);
      detail = (await getExamDetail(db, id))!;
    }
  }

  const { exam, candidate, items, score, integrity, events, suggested } = detail;
  const reviewing = exam.status === "submitted" || exam.status === "graded";
  const finished = reviewing || exam.status === "finalized";
  const canGrade = can(user.role, "gradeExams") && reviewing;
  const aiConfigured = Boolean(getConfiguredGrader());
  const writtenUngraded = items.filter((i) => !isObjective(i.snapshot.type) && !i.grade).length;
  const durationMin =
    exam.startedAt && exam.submittedAt ? Math.round((exam.submittedAt.getTime() - exam.startedAt.getTime()) / 60_000) : null;
  const integrityTone = integrity.level === "high" ? "red" : integrity.level === "medium" ? "amber" : "green";

  return (
    <>
      <PageHeader
        title={`${candidate.firstName} ${candidate.lastName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ExamStatusBadge status={exam.status} />
            {EXPERIENCE_LABELS[exam.experienceLevel]} · {items.length} questions · {exam.totalPoints} pts · {exam.timeLimitMinutes} min
          </span>
        }
        back={{ href: "/exams", label: "Exams & results" }}
        actions={
          <>
            <Link href={`/candidates/${candidate.id}`} className="btn-secondary">Candidate profile</Link>
            {finished && <Link href={`/exams/${id}/report`} className="btn-secondary">Printable report</Link>}
          </>
        }
      />

      {(exam.status === "ready" || exam.status === "in_progress") && (
        <section className="card card-body mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{exam.status === "ready" ? "Waiting for the candidate to start" : "Candidate is taking the exam"}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {exam.status === "ready"
                  ? <>Link {exam.linkExpiresAt < new Date() ? "expired" : "valid until"} {formatDate(exam.linkExpiresAt)}. {exam.invitedAt ? `Invitation sent ${formatDate(exam.invitedAt)}.` : "No invitation emailed yet."}</>
                  : <>Started {formatDate(exam.startedAt)} · time runs out {formatDate(exam.deadlineAt)}. The exam submits itself when time is up.</>}
              </p>
            </div>
            {can(user.role, "manageExams") && (
              <ActionForm action={revokeExamAction.bind(null, id)} confirm="Revoke this exam? The candidate's link will stop working.">
                <SubmitButton className="btn-danger">Revoke exam</SubmitButton>
              </ActionForm>
            )}
          </div>
          {can(user.role, "manageExams") && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <LinkPanel action={reissueLinkAction.bind(null, id)} />
            </div>
          )}
        </section>
      )}

      {exam.status === "revoked" && <div className="mb-6"><Alert tone="warning">This exam was revoked. The candidate can no longer open it.</Alert></div>}

      {finished && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card card-body">
              <div className="text-sm text-slate-500">Score</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">{score.percentage}%</div>
              <div className="text-xs text-slate-500">{score.earned} / {score.possible} pts{score.complete ? "" : " so far"}</div>
            </div>
            <div className="card card-body">
              <div className="text-sm text-slate-500">Grading</div>
              <div className="mt-1 text-lg font-semibold text-ink">
                {score.ungraded ? `${score.ungraded} ungraded` : score.needsReview ? `${score.needsReview} to review` : "Complete"}
              </div>
              <div className="text-xs text-slate-500">{items.length - score.ungraded} of {items.length} questions scored</div>
            </div>
            <div className="card card-body">
              <div className="text-sm text-slate-500">Integrity signals</div>
              <div className="mt-1"><Badge tone={integrityTone}>{integrity.level.toUpperCase()} risk</Badge></div>
              <div className="mt-1 text-xs text-slate-500">{integrity.total} browser event(s) recorded</div>
            </div>
            <div className="card card-body">
              <div className="text-sm text-slate-500">Timing</div>
              <div className="mt-1 text-lg font-semibold text-ink">{durationMin != null ? `${durationMin} of ${exam.timeLimitMinutes} min` : "—"}</div>
              <div className="text-xs text-slate-500">{exam.autoSubmitted ? "Submitted automatically when time ran out" : `Submitted ${formatDate(exam.submittedAt)}`}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <section className="card card-body lg:col-span-3">
              <h2 className="mb-3 font-semibold">By category</h2>
              <ul className="space-y-3">
                {score.byCategory.map((c) => (
                  <li key={c.category}>
                    <div className="flex justify-between text-sm"><span>{c.category}</span><span className="tabular-nums text-slate-600">{c.earned}/{c.possible} · {c.percentage}%</span></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100" role="presentation">
                      <div className={`h-2 rounded-full ${c.percentage >= 70 ? "bg-emerald-500" : c.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, c.percentage)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card card-body lg:col-span-2">
              <h2 className="mb-3 font-semibold">Decision</h2>
              {exam.status === "finalized" ? (
                <div className="space-y-2 text-sm">
                  <div className="text-lg font-semibold text-ink">{exam.decision ? DECISION_LABELS[exam.decision] : "—"}</div>
                  <div className="text-slate-500">Finalized by {exam.finalizedByName ?? "—"} on {formatDate(exam.finalizedAt)}</div>
                  {exam.reviewerNotes && <p className="prose-q rounded-lg bg-slate-50 p-3">{exam.reviewerNotes}</p>}
                  {can(user.role, "reopenExams") && (
                    <ActionForm action={reopenAction.bind(null, id)} confirm="Reopen this review? Grades become editable again.">
                      <SubmitButton className="btn-secondary btn-sm">Reopen review</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              ) : !score.complete || score.needsReview ? (
                <p className="text-sm text-slate-600">
                  Every question needs a confirmed score before a decision can be recorded.
                  {score.ungraded > 0 && ` ${score.ungraded} question(s) are not graded yet.`}
                  {score.needsReview > 0 && ` ${score.needsReview} AI-drafted grade(s) need an engineer's review.`}
                </p>
              ) : can(user.role, "finalizeExams") ? (
                <ActionForm action={finalizeAction.bind(null, id)} className="space-y-3">
                  {suggested && <p className="text-sm text-slate-600">Suggested from score and integrity signals: <strong>{DECISION_LABELS[suggested]}</strong></p>}
                  <div>
                    <label className="label" htmlFor="decision">Decision</label>
                    <select id="decision" name="decision" className="input" defaultValue={suggested ?? "further_interview"}>
                      {DECISIONS.map((d) => <option key={d} value={d}>{DECISION_LABELS[d]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="notes">Reviewer notes</label>
                    <textarea id="notes" name="notes" rows={4} className="input" placeholder="Strengths, gaps, topics for the interview…" />
                  </div>
                  <SubmitButton>Finalize review</SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-sm text-slate-600">Ready for an engineer to finalize.{suggested && <> Suggested: <strong>{DECISION_LABELS[suggested]}</strong>.</>}</p>
              )}
            </section>
          </div>

          {canGrade && (writtenUngraded > 0 || items.some((i) => i.grade?.source === "ai")) && (
            <section className="card card-body mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">AI grading assistant</h2>
                  <p className="text-sm text-slate-600">
                    {aiConfigured
                      ? "The AI grader drafts rubric scores for written answers, including uploaded photos and PDFs. Every draft must be accepted or changed by an engineer."
                      : "Not configured: set ANTHROPIC_API_KEY or OPENAI_API_KEY to have written answers drafted automatically. You can still grade by hand below."}
                  </p>
                </div>
                {aiConfigured && (
                  <div className="flex gap-2">
                    {writtenUngraded > 0 && (
                      <ActionForm action={runAiGradingAction.bind(null, id)}>
                        <SubmitButton className="btn-primary" pendingText="Grading…">Grade {writtenUngraded} written answer(s)</SubmitButton>
                      </ActionForm>
                    )}
                    {items.some((i) => i.grade?.source === "ai") && (
                      <ActionForm action={runAiGradingAction.bind(null, id)} confirm="Replace all AI drafts (human grades are kept)?">
                        <input type="hidden" name="regrade" value="1" />
                        <SubmitButton className="btn-secondary" pendingText="Grading…">Redo AI drafts</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {events.length > 0 && (
            <details className="card mt-6">
              <summary className="cursor-pointer px-5 py-3 font-semibold">Integrity timeline ({events.length})</summary>
              <div className="border-t border-slate-100 px-5 py-3 text-sm">
                <p className="mb-3 text-slate-500">Browser signals are indicators for discussion, not proof of misconduct. A brief focus change can be a notification or a calculator app.</p>
                <ul className="space-y-1">
                  {events.map((e) => (
                    <li key={e.id} className="flex gap-3">
                      <span className="w-40 shrink-0 tabular-nums text-slate-500">{formatDate(e.occurredAt)}</span>
                      <span>{INTEGRITY_LABELS[e.type]}{e.detail ? <span className="text-slate-500"> — {e.detail}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">{finished ? "Answers" : "Questions in this exam"}</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <QuestionReview
            key={item.id}
            examId={id}
            item={item}
            showAnswers={finished}
            canGrade={canGrade}
            typeLabel={QUESTION_TYPE_LABELS[item.snapshot.type]}
          />
        ))}
      </div>
    </>
  );
}
