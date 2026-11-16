import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import type { ExamStatus } from "@/db/schema";
import { can, rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { EXPERIENCE_LABELS } from "@/lib/labels";
import { listCandidates } from "@/lib/services/candidates";
import { EmptyState, ExamStatusBadge, formatDate, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const user = await requireUser([...new Set([...rolesFor("manageCandidates"), ...rolesFor("viewResults")])]);
  const { q, archived } = await searchParams;
  const rows = await listCandidates(await getDb(), { search: q, archived: archived === "1" });

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle={archived === "1" ? "Archived candidates" : "People being assessed"}
        actions={can(user.role, "manageCandidates") && <Link href="/candidates/new" className="btn-primary">Add candidate</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="input max-w-xs" />
        {archived === "1" && <input type="hidden" name="archived" value="1" />}
        <button className="btn-secondary">Search</button>
        <Link href={archived === "1" ? "/candidates" : "/candidates?archived=1"} className="btn-ghost">
          {archived === "1" ? "Show active" : "Show archived"}
        </Link>
      </form>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No candidates found">{can(user.role, "manageCandidates") ? "Add a candidate to create their first exam." : null}</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Level</th><th>Position</th><th>Latest exam</th><th>Added</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/candidates/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.firstName} {c.lastName}</Link>
                    <div className="text-xs text-slate-500">{c.email}</div>
                  </td>
                  <td>{EXPERIENCE_LABELS[c.experienceLevel]}</td>
                  <td>{c.position ?? "—"}</td>
                  <td>{c.latestStatus ? <ExamStatusBadge status={c.latestStatus as ExamStatus} /> : <span className="text-slate-400">None</span>}</td>
                  <td className="text-slate-500">{formatDate(c.createdAt, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
