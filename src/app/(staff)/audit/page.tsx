import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { EmptyState, formatDate, PageHeader } from "@/components/ui";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Audit log" };

const LINKS: Record<string, string> = { exam: "/exams/", candidate: "/candidates/", question: "/questions/" };

export default async function AuditPage() {
  await requireUser(rolesFor("viewAudit"));
  const rows = await listAuditLogs(await getDb(), { limit: 300 });
  return (
    <>
      <PageHeader title="Audit log" subtitle="The most recent 300 actions. Grade changes, decisions and account changes are all recorded." />
      <div className="card overflow-x-auto">
        {rows.length === 0 ? <EmptyState title="No activity yet" /> : (
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-slate-500">{formatDate(r.createdAt)}</td>
                  <td>{r.actorEmail ?? "system"}</td>
                  <td className="font-mono text-xs">{r.action}</td>
                  <td>{r.entityId && LINKS[r.entityType] ? <Link className="text-brand-700 hover:underline" href={`${LINKS[r.entityType]}${r.entityId}`}>{r.entityType}</Link> : r.entityType}</td>
                  <td className="max-w-md break-words font-mono text-xs text-slate-500">{r.details ? JSON.stringify(r.details) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
