import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { EXAM_STATUSES } from "@/db/schema";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { DECISION_LABELS } from "@/lib/domain/decision";
import { sweepAndSchedule } from "@/lib/grading-jobs";
import { EXAM_STATUS_LABELS, EXPERIENCE_LABELS } from "@/lib/labels";
import { listExams } from "@/lib/services/exams";
import { Badge, EmptyState, ExamStatusBadge, formatDate, PageHeader, pct } from "@/components/ui";

export const metadata: Metadata = { title: "Exams & results" };

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireUser(rolesFor("viewResults"));
  const { status, q } = await searchParams;
  await sweepAndSchedule();
  const rows = await listExams(await getDb(), { status, search: q });

  return (
    <>
      <PageHeader title="Exams & results" subtitle="Create exams from a candidate's page." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search candidate" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ""} className="input max-w-[200px]">
          <option value="">All statuses</option>
          {EXAM_STATUSES.map((s) => <option key={s} value={s}>{EXAM_STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No exams match">Open a candidate to create their exam.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Candidate</th><th>Level</th><th>Status</th><th>Score</th><th>Decision</th><th>Created</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/exams/${e.id}`} className="font-medium text-brand-700 hover:underline">{e.candidateName}</Link>
                    <div className="text-xs text-slate-500">{e.candidateEmail}</div>
                  </td>
                  <td>{EXPERIENCE_LABELS[e.experienceLevel]}</td>
                  <td className="space-x-1">
                    <ExamStatusBadge status={e.status} />
                    {e.pendingReview > 0 && <Badge tone="violet">{e.pendingReview} to review</Badge>}
                  </td>
                  <td className="tabular-nums">{e.status === "graded" || e.status === "finalized" ? pct(e.earned, e.totalPoints) : "—"}</td>
                  <td>
                    {e.decision ? DECISION_LABELS[e.decision] : e.suggestedDecision ? <span className="text-slate-500">Suggested: {DECISION_LABELS[e.suggestedDecision]}</span> : "—"}
                  </td>
                  <td className="text-slate-500">{formatDate(e.createdAt, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
