import type { Metadata } from "next";
import { getDb } from "@/db";
import { PageHeader } from "@/components/ui";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/questions";
import { saveQuestionAction } from "../actions";
import { QuestionForm } from "../question-form";

export const metadata: Metadata = { title: "New question" };

export default async function NewQuestionPage() {
  await requireUser(rolesFor("manageQuestions"));
  const categories = await listCategories(await getDb());
  return (
    <>
      <PageHeader title="New question" back={{ href: "/questions", label: "Question bank" }} />
      <div className="card card-body">
        <QuestionForm
          action={saveQuestionAction.bind(null, null)}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            categoryId: "",
            type: "short_answer",
            experienceLevel: "entry",
            difficulty: 2,
            prompt: "",
            referenceAnswer: "",
            explanation: "",
            points: 10,
            allowAttachment: true,
            figureId: null,
            figureAlt: "",
            status: "draft",
            options: [],
            rubric: [{ criterion: "", guidance: "", maxPoints: 10 }],
          }}
        />
      </div>
    </>
  );
}
