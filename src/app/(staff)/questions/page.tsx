import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { EXPERIENCE_LEVELS, QUESTION_STATUSES, QUESTION_TYPES } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader, QuestionStatusBadge } from "@/components/ui";
import { can, rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { EXPERIENCE_LABELS, QUESTION_STATUS_LABELS, QUESTION_TYPE_LABELS } from "@/lib/labels";
import { listCategories, listQuestions, publishedCounts } from "@/lib/services/questions";
import { createCategoryAction } from "./actions";

export const metadata: Metadata = { title: "Question bank" };

type Search = { q?: string; category?: string; type?: string; level?: string; status?: string };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser(rolesFor("viewQuestions"));
  const sp = await searchParams;
  const db = await getDb();
  const [rows, categories, counts] = await Promise.all([
    listQuestions(db, { search: sp.q, categoryId: sp.category, type: sp.type, level: sp.level, status: sp.status }),
    listCategories(db),
    publishedCounts(db),
  ]);
  const canManage = can(user.role, "manageQuestions");

  return (
    <>
      <PageHeader
        title="Question bank"
        subtitle={`Published: ${EXPERIENCE_LEVELS.map((l) => `${EXPERIENCE_LABELS[l]} ${counts[l] ?? 0}`).join(" · ")}`}
        actions={canManage && <Link href="/questions/new" className="btn-primary">New question</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search text" className="input max-w-xs" />
        <select name="category" defaultValue={sp.category ?? ""} className="input max-w-[200px]">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="level" defaultValue={sp.level ?? ""} className="input max-w-[200px]">
          <option value="">All levels</option>
          {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{EXPERIENCE_LABELS[l]}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="input max-w-[220px]">
          <option value="">All types</option>
          {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[180px]">
          <option value="">Draft & published</option>
          {QUESTION_STATUSES.map((s) => <option key={s} value={s}>{QUESTION_STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No questions match these filters" />
        ) : (
          <table className="table">
            <thead><tr><th className="w-1/2">Question</th><th>Category</th><th>Level</th><th>Type</th><th>Pts</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td><Link href={`/questions/${q.id}`} className="line-clamp-2 text-brand-700 hover:underline">{q.prompt}</Link></td>
                  <td>{q.categoryName}</td>
                  <td>{EXPERIENCE_LABELS[q.experienceLevel]}</td>
                  <td>{QUESTION_TYPE_LABELS[q.type]}</td>
                  <td className="tabular-nums">{q.points}</td>
                  <td><QuestionStatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <section className="card card-body mt-6 max-w-xl">
          <h2 className="font-semibold">Categories</h2>
          <p className="mb-3 text-sm text-slate-500">{categories.map((c) => c.name).join(" · ") || "None yet."}</p>
          <ActionForm action={createCategoryAction} resetOnSuccess className="flex flex-wrap gap-2">
            <input name="name" placeholder="New category name" className="input max-w-xs" required />
            <SubmitButton className="btn-secondary">Add category</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}
