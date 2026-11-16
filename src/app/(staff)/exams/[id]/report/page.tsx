import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { DECISION_LABELS } from "@/lib/domain/decision";
import { INTEGRITY_LABELS } from "@/lib/domain/integrity";
import { EXPERIENCE_LABELS } from "@/lib/labels";
import { getExamDetail } from "@/lib/services/exams";
import { formatDate } from "@/components/ui";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Assessment report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(rolesFor("viewResults"));
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getExamDetail(await getDb(), id);
  if (!detail) notFound();
  const { exam, candidate, score, integrity, items, suggested } = detail;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="mb-6 flex items-start justify-between print:hidden">
        <a href={`/exams/${id}`} className="text-sm text-slate-500 hover:text-slate-800">← Back to exam</a>
        <PrintButton />
      </div>
      <h1 className="text-2xl font-semibold">Technical assessment report</h1>
      <p className="text-slate-500">INNOVA · Confidential — for hiring purposes only</p>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-slate-500">Candidate</dt><dd>{candidate.firstName} {candidate.lastName} ({candidate.email})</dd>
        <dt className="text-slate-500">Position</dt><dd>{candidate.position ?? "—"}</dd>
        <dt className="text-slate-500">Exam level</dt><dd>{EXPERIENCE_LABELS[exam.experienceLevel]}</dd>
        <dt className="text-slate-500">Taken</dt><dd>{formatDate(exam.startedAt)} → {formatDate(exam.submittedAt)}{exam.autoSubmitted ? " (time expired)" : ""}</dd>
        <dt className="text-slate-500">Score</dt><dd className="font-semibold">{score.earned} / {score.possible} ({score.percentage}%){score.complete ? "" : " — grading incomplete"}</dd>
        <dt className="text-slate-500">Integrity signals</dt><dd>{integrity.level} ({integrity.total} events)</dd>
        <dt className="text-slate-500">Decision</dt>
        <dd className="font-semibold">{exam.decision ? DECISION_LABELS[exam.decision] : suggested ? `Not finalized (suggested: ${DECISION_LABELS[suggested]})` : "Not finalized"}</dd>
        {exam.finalizedAt && (<><dt className="text-slate-500">Reviewed by</dt><dd>{exam.finalizedByName} on {formatDate(exam.finalizedAt)}</dd></>)}
      </dl>

      {exam.reviewerNotes && (
        <section className="mt-6">
          <h2 className="font-semibold">Reviewer notes</h2>
          <p className="prose-q mt-1 text-sm">{exam.reviewerNotes}</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold">Results by category</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b text-left text-slate-500"><th className="py-1">Category</th><th className="py-1 text-right">Points</th><th className="py-1 text-right">%</th></tr></thead>
          <tbody>
            {score.byCategory.map((c) => (
              <tr key={c.category} className="border-b border-slate-100"><td className="py-1">{c.category}</td><td className="py-1 text-right tabular-nums">{c.earned}/{c.possible}</td><td className="py-1 text-right tabular-nums">{c.percentage}%</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {integrity.total > 0 && (
        <section className="mt-6 text-sm">
          <h2 className="font-semibold">Integrity signals</h2>
          <ul className="mt-1 list-disc pl-5">
            {Object.entries(integrity.counts).map(([type, n]) => <li key={type}>{INTEGRITY_LABELS[type as keyof typeof INTEGRITY_LABELS]}: {n}</li>)}
          </ul>
        </section>
      )}

      <section className="mt-6 text-sm">
        <h2 className="font-semibold">Question scores</h2>
        <ol className="mt-2 space-y-2">
          {items.map((i) => (
            <li key={i.id} className="break-inside-avoid border-b border-slate-100 pb-2">
              <div className="flex justify-between gap-4"><span>Q{i.position}. {i.snapshot.prompt.split("\n")[0].slice(0, 140)}</span><span className="shrink-0 tabular-nums">{i.grade ? `${i.grade.points}/${i.points}` : `—/${i.points}`}</span></div>
              {i.grade?.feedback && i.grade.source !== "auto" && <p className="mt-1 text-slate-500">{i.grade.feedback}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
