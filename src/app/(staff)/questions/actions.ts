"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { QUESTION_STATUSES, type QuestionStatus } from "@/db/schema";
import { type ActionState, attempt, formObject } from "@/lib/actions";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { ServiceError } from "@/lib/services/common";
import { createCategory, createQuestion, setQuestionStatus, updateQuestion } from "@/lib/services/questions";

function payload(formData: FormData) {
  try {
    return JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    throw new ServiceError("Invalid form data.");
  }
}

export async function saveQuestionAction(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageQuestions"));
  let createdId: string | null = null;
  const result = await attempt(async () => {
    const db = await getDb();
    if (id) await updateQuestion(db, user, id, payload(formData));
    else createdId = (await createQuestion(db, user, payload(formData))).id;
    revalidatePath("/questions");
    return { ok: true, message: "Question saved." };
  });
  if (createdId && !result.error) redirect(`/questions/${createdId}?created=1`);
  return result;
}

export async function setQuestionStatusAction(id: string, status: QuestionStatus) {
  const user = await requireUser(rolesFor("manageQuestions"));
  if (!QUESTION_STATUSES.includes(status)) return;
  await setQuestionStatus(await getDb(), user, id, status);
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
}

export async function createCategoryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageQuestions"));
  return attempt(async () => {
    await createCategory(await getDb(), user, formObject(formData));
    revalidatePath("/questions");
    return { ok: true, message: "Category added." };
  });
}
