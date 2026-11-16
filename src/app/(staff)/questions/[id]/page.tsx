import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { Alert, formatDate, PageHeader, QuestionStatusBadge } from "@/components/ui";
import { can, rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getQuestion, listCategories } from "@/lib/services/questions";
import { saveQuestionAction, setQuestionStatusAction } from "../actions";
import { QuestionForm } from "../question-form";

export const metadata: Metadata = { title: "Edit question" };

export default async function QuestionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser(rolesFor("viewQuestions"));
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [q, categories] = await Promise.all([getQuestion(db, id), listCategories(db)]);
  if (!q) notFound();
  const canManage = can(user.role, "manageQuestions");

  return (
    <>
      <PageHeader
        title={canManage ? "Edit question" : "Question"}
        subtitle={<span className="flex items-center gap-2"><QuestionStatusBadge status={q.status} /> Updated {formatDate(q.updatedAt)}</span>}
        back={{ href: "/questions", label: "Question bank" }}
        actions={
          canManage && (
            <form action={setQuestionStatusAction.bind(null, id, q.status === "archived" ? "draft" : "archived")}>
              <button className="btn-secondary">{q.status === "archived" ? "Restore as draft" : "Archive"}</button>
            </form>
          )
        }
      />
      {created && <div className="mb-4"><Alert tone="success">Question created.</Alert></div>}
      <div className="mb-4"><Alert tone="info">Edits apply to future exams only. Exams already generated keep the version the candidate saw.</Alert></div>
      <div className="card card-body">
        <QuestionForm
          action={saveQuestionAction.bind(null, id)}
          readOnly={!canManage}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            categoryId: q.categoryId,
            type: q.type,
            experienceLevel: q.experienceLevel,
            difficulty: q.difficulty,
            prompt: q.prompt,
            referenceAnswer: q.referenceAnswer ?? "",
            explanation: q.explanation ?? "",
            points: q.points,
            allowAttachment: q.allowAttachment,
            status: q.status,
            options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
            rubric: q.rubric.map((r) => ({ criterion: r.criterion, guidance: r.guidance ?? "", maxPoints: r.maxPoints })),
          }}
        />
      </div>
    </>
  );
}
