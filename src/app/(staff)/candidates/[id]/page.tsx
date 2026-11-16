import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { EXPERIENCE_LEVELS } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, ExamStatusBadge, formatDate, PageHeader, pct } from "@/components/ui";
import { can, rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { DECISION_LABELS } from "@/lib/domain/decision";
import { EXPERIENCE_LABELS } from "@/lib/labels";
import { getCandidate } from "@/lib/services/candidates";
import { listExams } from "@/lib/services/exams";
import { listCategories, publishedCounts } from "@/lib/services/questions";
import { archiveCandidateAction, createExamAction, updateCandidateAction } from "../actions";
import { CandidateFields } from "../candidate-fields";
import { CreateExamForm } from "./create-exam-form";

export const metadata: Metadata = { title: "Candidate" };

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser([...new Set([...rolesFor("manageCandidates"), ...rolesFor("viewResults")])]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const candidate = await getCandidate(db, id);
  if (!candidate) notFound();
  const [exams, categories, counts] = await Promise.all([listExams(db, { candidateId: id }), listCategories(db), publishedCounts(db)]);
  const canManage = can(user.role, "manageCandidates");
  const hasOpenExam = exams.some((e) => e.status === "ready" || e.status === "in_progress");

  return (
    <>
      <PageHeader
        title={`${candidate.firstName} ${candidate.lastName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {candidate.email} · {EXPERIENCE_LABELS[candidate.experienceLevel]}
            {candidate.archived && <Badge tone="red">Archived</Badge>}
          </span>
        }
        back={{ href: "/candidates", label: "Candidates" }}
        actions={
          canManage && (
            <form action={archiveCandidateAction.bind(null, id, !candidate.archived)}>
              <button className="btn-secondary">{candidate.archived ? "Restore" : "Archive"}</button>
            </form>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="card">
            <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Exams</h2>
            {exams.length === 0 ? (
              <EmptyState title="No exams yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Created</th><th>Status</th><th>Score</th><th>Decision</th><th></th></tr></thead>
                  <tbody>
                    {exams.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDate(e.createdAt)}<div className="text-xs text-slate-500">{EXPERIENCE_LABELS[e.experienceLevel]}</div></td>
                        <td><ExamStatusBadge status={e.status} /></td>
                        <td className="tabular-nums">{e.status === "graded" || e.status === "finalized" ? pct(e.earned, e.totalPoints) : "—"}</td>
                        <td>{e.decision ? DECISION_LABELS[e.decision] : "—"}</td>
                        <td className="text-right"><Link className="btn-secondary btn-sm" href={`/exams/${e.id}`}>Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {can(user.role, "manageExams") && !candidate.archived && (
            <section className="card card-body">
              <h2 className="mb-1 font-semibold">New exam</h2>
              <p className="mb-4 text-sm text-slate-500">Questions are drawn at random from the published bank for the chosen level and frozen into this exam.</p>
              <CreateExamForm
                action={createExamAction.bind(null, id)}
                hasOpenExam={hasOpenExam}
                defaultLevel={candidate.experienceLevel}
                levels={EXPERIENCE_LEVELS.map((l) => ({ value: l, label: EXPERIENCE_LABELS[l], published: counts[l] ?? 0 }))}
                categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              />
            </section>
          )}
        </div>

        <section className="card card-body lg:col-span-2">
          <h2 className="mb-4 font-semibold">Profile</h2>
          <ActionForm action={updateCandidateAction.bind(null, id)} className="space-y-4">
            <CandidateFields candidate={candidate} disabled={!canManage} />
            {canManage && <SubmitButton>Save changes</SubmitButton>}
          </ActionForm>
          <p className="mt-4 text-xs text-slate-400">Added {formatDate(candidate.createdAt)}</p>
        </section>
      </div>
    </>
  );
}
