import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { sweepAndSchedule } from "@/lib/grading-jobs";
import { getDashboard } from "@/lib/services/dashboard";
import { DECISION_LABELS } from "@/lib/domain/decision";
import type { Decision } from "@/db/schema";
import { Alert, EmptyState, ExamStatusBadge, formatDate, PageHeader, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  await sweepAndSchedule();
  const d = await getDashboard(await getDb());
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && process.env.AI_GRADING_DISABLED !== "true";

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="Where every candidate assessment stands today."
        actions={can(user.role, "manageCandidates") && <Link href="/candidates/new" className="btn-primary">Add candidate</Link>}
      />
      {denied && <div className="mb-4"><Alert tone="warning">Your role does not have access to that page.</Alert></div>}
      {!aiEnabled && (
        <div className="mb-4">
          <Alert tone="info">AI grading is off (no <code>ANTHROPIC_API_KEY</code>). Written answers will wait for an engineer to grade them.</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Awaiting review" value={(d.byStatus.submitted ?? 0) + (d.byStatus.graded ?? 0)} hint="Submitted exams not yet finalized" href="/exams?status=graded" />
        <Stat label="In progress" value={d.byStatus.in_progress ?? 0} hint="Candidates taking an exam now" href="/exams?status=in_progress" />
        <Stat label="Invited, not started" value={d.byStatus.ready ?? 0} href="/exams?status=ready" />
        <Stat label="Average final score" value={d.averageScore == null ? "—" : `${d.averageScore}%`} hint={`${d.finalizedCount} finalized in the last 90 days`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Needs review</h2>
          {d.awaitingReview.length === 0 ? (
            <EmptyState title="Nothing waiting">Submitted exams appear here until they are finalized.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.awaitingReview.map((e) => (
                <li key={e.id}>
                  <Link href={`/exams/${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <span>
                      <span className="font-medium">{e.candidateName}</span>
                      <span className="block text-xs text-slate-500">Submitted {formatDate(e.submittedAt)}</span>
                    </span>
                    <ExamStatusBadge status={e.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Taking an exam now</h2>
          {d.inProgress.length === 0 ? (
            <EmptyState title="No exams in progress" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.inProgress.map((e) => (
                <li key={e.id}>
                  <Link href={`/exams/${e.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <span className="font-medium">{e.candidateName}</span>
                    <span className="text-xs text-slate-500">Ends {formatDate(e.deadlineAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Active candidates" value={d.candidates} href="/candidates" />
        <Stat label="Published questions" value={d.published} href="/questions?status=published" />
        <div className="card card-body">
          <div className="text-sm text-slate-500">Decisions (90 days)</div>
          {Object.keys(d.decisions).length === 0 ? (
            <div className="mt-2 text-sm text-slate-400">None yet</div>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(d.decisions).map(([k, v]) => (
                <li key={k} className="flex justify-between"><span>{DECISION_LABELS[k as Decision]}</span><span className="tabular-nums font-medium">{v}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
